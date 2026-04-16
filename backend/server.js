const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid"); // use uuid@8

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/merchantDB")
  .then(() => console.log("MongoDB Connected ✅"));

/* ================= SCHEMA ================= */

const WorkflowSchema = new mongoose.Schema({
  _id: String,
  tenant_id: String,
  name: String,
  trigger_event: String,
  is_active: Boolean,
  steps: Array
});

const ExecutionSchema = new mongoose.Schema({
  _id: String,
  workflow_id: String,
  tenant_id: String,
  status: String,
  logs: Array,
  created_at: { type: Date, default: Date.now }
});

const Workflow = mongoose.model("Workflow", WorkflowSchema);
const Execution = mongoose.model("Execution", ExecutionSchema);

/* ================= CREATE WORKFLOW ================= */

app.post("/workflow", async (req, res) => {

  const { name, trigger_event, steps, tenant_id } = req.body;

  if (!name || !trigger_event) {
    return res.status(400).json({ error: "Name & trigger required" });
  }

  if (!steps || steps.length === 0) {
    return res.status(400).json({ error: "Steps required" });
  }

  const workflow = new Workflow({
    _id: uuidv4(),
    tenant_id: tenant_id || "T1", // ✅ multi-tenant support
    name,
    trigger_event,
    is_active: true,
    steps
  });

  await workflow.save();

  res.json(workflow);
});

/* ================= GET WORKFLOWS ================= */

app.get("/workflow/:tenant_id", async (req, res) => {
  const data = await Workflow.find({ tenant_id: req.params.tenant_id });
  res.json(data);
});

/* ================= DELETE WORKFLOW ================= */

app.delete("/workflow/:id", async (req, res) => {

  const { tenant_id } = req.body;

  const deleted = await Workflow.findOneAndDelete({
    _id: req.params.id,
    tenant_id
  });

  if (!deleted) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  res.json({ message: "Deleted" });
});

/* ================= EXECUTE WORKFLOW ================= */

app.post("/execute", async (req, res) => {

  const { workflowId, payload, tenant_id } = req.body;

  if (!payload || !payload.data) {
    return res.json({
      status: "failed",
      logs: ["Invalid payload"]
    });
  }

  // ✅ Multi-tenant secure fetch
  const workflow = await Workflow.findOne({
    _id: workflowId,
    tenant_id
  });

  if (!workflow) {
    return res.json({
      status: "failed",
      logs: ["Unauthorized or workflow not found"]
    });
  }

  if (!workflow.steps || workflow.steps.length === 0) {
    return res.json({
      status: "failed",
      logs: ["No steps found"]
    });
  }

  let logs = [];
  let status = "in_progress";

  logs.push("Execution started");

  let currentStep = workflow.steps[0];

  while (currentStep) {

    logs.push(`➡️ Step: ${currentStep.name}`);

    if (!currentStep.rules || currentStep.rules.length === 0) {
      logs.push("Workflow completed");
      status = "completed";
      break;
    }

    let matched = null;

    for (let rule of currentStep.rules) {

      // DEFAULT RULE
      if (rule.condition === "DEFAULT") {
        matched = rule;
        break;
      }

      try {
        let condition = rule.condition;

        // Map simple keywords → payload
        condition = condition.replace(/amount/g, "data.order_details.total_amount");
        condition = condition.replace(/loyalty/g, "data.customer.loyalty_tier");

        // safer execution than eval
        const result = new Function(
          "data",
          `return ${condition}`
        )(payload.data);

        logs.push(`Check: ${condition} → ${result}`);

        if (result) {
          matched = rule;
          break;
        }

      } catch (err) {
        logs.push("Condition error");
      }
    }

    if (!matched) {
      logs.push("No rule matched");
      status = "failed";
      break;
    }

    logs.push(`➡️ Next: ${matched.next_step_id}`);

    const next = workflow.steps.find(
      s => s.step_id.toLowerCase() === matched.next_step_id.toLowerCase()
    );

    if (!next) {
      logs.push("End of workflow");
      status = "completed";
      break;
    }

    currentStep = next;
  }

  // ✅ Save execution with tenant isolation
  await new Execution({
    _id: uuidv4(),
    workflow_id: workflowId,
    tenant_id,
    status,
    logs
  }).save();

  res.json({ status, logs });
});

/* ================= START SERVER ================= */

app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
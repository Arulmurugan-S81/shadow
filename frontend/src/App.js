import { useState, useEffect } from "react";
import "./App.css";

function App() {

  const tenant_id = "T1";

  const [page, setPage] = useState("dashboard");
  const [workflows, setWorkflows] = useState([]);

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [steps, setSteps] = useState([]);

  const [jsonInput, setJsonInput] = useState(`{
  "event": "order.created",
  "data": {
    "order_details": { "total_amount": 750 },
    "customer": { "loyalty_tier": "Gold" }
  }
}`);

  const [output, setOutput] = useState("");

  useEffect(() => {
    loadWorkflows();
  }, []);

  /* ================= LOAD ================= */

  const loadWorkflows = async () => {
    try {
      const res = await fetch(`http://localhost:5000/workflow/${tenant_id}`);
      const data = await res.json();
      setWorkflows(data);
    } catch {
      alert("⚠️ Backend not running!");
    }
  };

  /* ================= STEP ================= */

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_id: "step-" + (steps.length + 1),
        name: "",
        step_type: "action",
        rules: []
      }
    ]);
  };

  const removeStep = (i) => {
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  /* ================= RULE ================= */

  const addRule = (i) => {
    const updated = [...steps];

    if (!updated[i].rules) updated[i].rules = [];

    updated[i].rules.push({
      priority: 1,
      condition: "",
      next_step_id: ""
    });

    setSteps(updated);
  };

  const removeRule = (i, j) => {
    const updated = [...steps];

    if (!updated[i].rules) return;

    updated[i].rules = updated[i].rules.filter((_, idx) => idx !== j);
    setSteps(updated);
  };

  /* ================= SAVE ================= */

  const saveWorkflow = async () => {

    if (!name || !trigger) {
      alert("Enter workflow name & trigger");
      return;
    }

    if (steps.length === 0) {
      alert("Add at least one step!");
      return;
    }

    try {
      await fetch("http://localhost:5000/workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id,
          name,
          trigger_event: trigger,
          is_active: true,
          steps
        })
      });

      alert("Saved!");
      setSteps([]);
      setName("");
      loadWorkflows();

    } catch {
      alert("Error saving workflow");
    }
  };

  /* ================= DELETE (FIXED 🔥) ================= */

  const deleteWorkflow = async (id) => {
    try {
      await fetch(`http://localhost:5000/workflow/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenant_id // ✅ FIX
        })
      });

      loadWorkflows();

    } catch {
      alert("Delete failed");
    }
  };

  /* ================= EXECUTE ================= */

  const runWorkflow = async (id) => {

    try {

      const parsed = JSON.parse(jsonInput);

      const res = await fetch("http://localhost:5000/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          workflowId: id,
          tenant_id,
          payload: parsed
        })
      });

      const data = await res.json();

      if (!data || !data.logs) {
        setOutput("❌ Invalid response");
        return;
      }

      let text = `STATUS: ${data.status}\n\n`;

      data.logs.forEach(log => {
        text += log + "\n";
      });

      setOutput(text);

    } catch {
      alert("Execution failed");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="container">

      <div className="sidebar">
        <h2>Merchant Hub</h2>
        <button onClick={() => setPage("dashboard")}>Dashboard</button>
        <button onClick={() => setPage("create")}>Create Workflow</button>
        <button onClick={() => setPage("simulator")}>Simulator</button>
      </div>

      <div className="main">

        {page === "dashboard" && (
          <div className="card">
            <h2>Workflow Dashboard</h2>

            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Trigger</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {Array.isArray(workflows) && workflows.map((w,i)=>(
                  <tr key={i}>
                    <td>{w.name}</td>
                    <td>{w.trigger_event}</td>
                    <td>
                      <button onClick={()=>runWorkflow(w._id)}>Run</button>
                      <button className="delete-btn" onClick={()=>deleteWorkflow(w._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page === "create" && (
          <div className="card">

            <h2>Create Workflow</h2>

            <input placeholder="Workflow Name" onChange={e=>setName(e.target.value)} />
            <input placeholder="Trigger" onChange={e=>setTrigger(e.target.value)} />

            <button onClick={addStep}>Add Step</button>

            {steps.map((step,i)=>(
              <div key={i} className="step-card">

                <input placeholder="Step Name"
                  onChange={e=>{
                    const u=[...steps];
                    u[i].name=e.target.value;
                    setSteps(u);
                  }}
                />

                <select onChange={e=>{
                  const u=[...steps];
                  u[i].step_type=e.target.value;
                  setSteps(u);
                }}>
                  <option value="action">Action</option>
                  <option value="approval">Approval</option>
                  <option value="notification">Notification</option>
                </select>

                <button className="delete-btn" onClick={()=>removeStep(i)}>Remove Step</button>

                <button onClick={()=>addRule(i)}>Add Rule</button>

                {step.rules.map((r,j)=>(
                  <div key={j} className="rule-row">

                    <input placeholder="Condition (amount > 500 && loyalty == 'Gold')"
                      onChange={e=>{
                        const u=[...steps];
                        u[i].rules[j].condition=e.target.value;
                        setSteps(u);
                      }}
                    />

                    <input placeholder="Next Step ID"
                      onChange={e=>{
                        const u=[...steps];
                        u[i].rules[j].next_step_id=e.target.value;
                        setSteps(u);
                      }}
                    />

                    <button className="delete-btn" onClick={()=>removeRule(i,j)}>Remove</button>

                  </div>
                ))}

              </div>
            ))}

            <button onClick={saveWorkflow}>Save</button>
          </div>
        )}

        {page === "simulator" && (
          <div className="card">

            <h2>Execution Simulator</h2>

            <textarea value={jsonInput} onChange={e=>setJsonInput(e.target.value)} />

            {Array.isArray(workflows) && workflows.map((w,i)=>(
              <button key={i} onClick={()=>runWorkflow(w._id)}>
                Run {w.name}
              </button>
            ))}

            <pre className="output">{output}</pre>

          </div>
        )}

      </div>
    </div>
  );
}

export default App;
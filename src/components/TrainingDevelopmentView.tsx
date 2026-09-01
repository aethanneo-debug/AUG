import React, { useState, useEffect } from "react";
import { UserRole, TrainingProgram, TrainingParticipant, TrainingLiquidationExpense, Employee } from "../types";
import { apiCall } from "../utils";
import { BookOpen, Calendar, DollarSign, Users, Plus, Target, Building, FileText, CheckCircle2, Edit2, Trash2, Save, X, AlertTriangle, PieChart } from "lucide-react";

export default function TrainingDevelopmentView({ user, triggerRefresh }: { user: any, triggerRefresh: () => void }) {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [activeFy, setActiveFy] = useState<any>(null);
  const [trainingBudgets, setTrainingBudgets] = useState<any[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newAnnualBudget, setNewAnnualBudget] = useState("");
  const [participants, setParticipants] = useState<TrainingParticipant[]>([]);
  const [liquidations, setLiquidations] = useState<TrainingLiquidationExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [showLiqModal, setShowLiqModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  
  // Table editing state
  const [editingRows, setEditingRows] = useState<{ [key: string]: any }>({});
  const [newRows, setNewRows] = useState<any[]>([]);
  const [showParticipantModal, setShowParticipantModal] = useState<string | null>(null); // row id or "new-index"
  const [participantModalData, setParticipantModalData] = useState<any>(null); // To hold participants for the modal
  
  const [showBreakdownModal, setShowBreakdownModal] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<{ category: string; total: number }[]>([]);
  const [breakdownProgram, setBreakdownProgram] = useState<any>(null);
  const [breakdownTotal, setBreakdownTotal] = useState<number>(0);
  
  // Liquidation form
  const [expenseCategory, setExpenseCategory] = useState("Meals");
  const [liqDesc, setLiqDesc] = useState("");
  const [liqAmount, setLiqAmount] = useState("");
  const [liqDate, setLiqDate] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const fyRes = await apiCall("/api/fiscal-years/active");
    if (fyRes && !fyRes.error) setActiveFy(fyRes);

    const bRes = await apiCall("/api/training/budgets");
    if (bRes.status === "success") setTrainingBudgets(bRes.data);

    const pRes = await apiCall("/api/training/programs");
    if (pRes.status === "success") setPrograms(pRes.data);
    
    const partRes = await apiCall("/api/training/participants");
    if (partRes.status === "success") setParticipants(partRes.data);
    
    const lRes = await apiCall("/api/training/liquidations");
    if (lRes.status === "success") setLiquidations(lRes.data);

    const empRes = await apiCall("/api/employees");
    if (empRes.status === "success") setEmployees(empRes.data);
  }

  async function handleSetAnnualBudget(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      fiscalYearId: activeFy?.id || "fy-1",
      newAnnualBudget: newAnnualBudget
    };
    const res = await apiCall("/api/training/budgets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (res.status === "success") {
      setShowBudgetModal(false);
      fetchData();
      triggerRefresh();
    } else {
      alert("Error: " + res.message);
    }
  }

  const activeTb = trainingBudgets.find(b => b.fiscalYearId === (activeFy?.id || "fy-1"));
  const activeBudget = activeTb?.totalBudget || 0;
  const activeCarryOver = activeTb?.carryOverBudget || 0;
  const activeNewAnnual = activeTb?.newAnnualBudget !== undefined ? activeTb.newAnnualBudget : (activeBudget - activeCarryOver);

  const activePrograms = programs.filter(p => p.fiscalYear === (activeFy?.label || "2026"));
  
  // Calculate total allocated
  const existingAllocated = activePrograms.reduce((sum, p) => sum + Number(p.allocatedBudget), 0);
  
  // Add new rows allocated budget + editing rows changes
  let draftTotalAllocated = existingAllocated;
  activePrograms.forEach(p => {
    if (editingRows[p.id]) {
      draftTotalAllocated += (Number(editingRows[p.id].allocatedBudget || 0) - Number(p.allocatedBudget));
    }
  });
  newRows.forEach(nr => {
    draftTotalAllocated += Number(nr.allocatedBudget || 0);
  });
  
  const remainingAnnualBudget = activeBudget - draftTotalAllocated;

  const handleAddRow = () => {
    const newId = `new-${Date.now()}`;
    setNewRows([...newRows, {
      id: newId,
      title: "",
      description: "",
      category: "Technical",
      allocatedBudget: 0,
      startDate: "",
      endDate: "",
      startTime: "08:00",
      endTime: "17:00",
      venue: "",
      facilitator: "",
      maxParticipants: 1,
      targetDivision: "",
      participantIds: [],
      fiscalYear: activeFy?.label || "2026"
    }]);
  };

  const handleSaveRow = async (id: string, isNew: boolean) => {
    const row = isNew ? newRows.find(r => r.id === id) : editingRows[id];
    if (!row) return;

    if (!row.title || !row.startDate || !row.endDate) {
      alert("Please fill in the required fields (Title, Start Date, End Date).");
      return;
    }

    if (new Date(row.endDate) < new Date(row.startDate)) {
      alert("End Date cannot be earlier than Start Date.");
      return;
    }

    if (remainingAnnualBudget < 0) {
      alert("Error: Total allocated budget exceeds the available fiscal year budget. Please adjust allocations.");
      return;
    }

    let endpoint = "/api/training/programs";
    let method = "POST";
    if (!isNew) {
      endpoint = `/api/training/programs/${id}`;
      method = "PUT";
    }

    let res;
    try {
      res = await apiCall(endpoint, {
        method,
        body: JSON.stringify(row)
      });
    } catch (err: any) {
      alert("Error saving training program: " + err.message);
      return;
    }

    if (res && res.status === "success") {
      if (isNew) {
        setNewRows(newRows.filter(r => r.id !== id));
      } else {
        const updated = { ...editingRows };
        delete updated[id];
        setEditingRows(updated);
      }
      fetchData();
      triggerRefresh();
    } else {
      alert("Error: " + res.message);
    }
  };

  const handleDeleteProgram = async (id: string, isNew: boolean) => {
    if (isNew) {
      setNewRows(newRows.filter(r => r.id !== id));
      return;
    }
    if (!confirm("Are you sure you want to delete this training program?")) return;
    
    const res = await apiCall(`/api/training/programs/${id}`, { method: "DELETE" });
    if (res.status === "success") {
      fetchData();
      triggerRefresh();
    } else {
      alert("Error: " + res.message);
    }
  };

  const startEditing = (p: TrainingProgram) => {
    setEditingRows({
      ...editingRows,
      [p.id]: {
        ...p,
        participantIds: participants.filter(part => part.trainingProgramId === p.id).map(part => part.employeeId)
      }
    });
  };

  const updateRow = (id: string, field: string, value: any, isNew: boolean) => {
    if (isNew) {
      setNewRows(newRows.map(r => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          if (field === 'startDate' && updated.endDate && new Date(updated.endDate) < new Date(value)) {
            updated.endDate = value;
          }
          if (field === 'endDate' && updated.startDate && new Date(value) < new Date(updated.startDate)) {
            updated.startDate = value;
          }
          return updated;
        }
        return r;
      }));
    } else {
      const current = editingRows[id];
      const updated = { ...current, [field]: value };
      if (field === 'startDate' && updated.endDate && new Date(updated.endDate) < new Date(value)) {
        updated.endDate = value;
      }
      if (field === 'endDate' && updated.startDate && new Date(value) < new Date(updated.startDate)) {
        updated.startDate = value;
      }
      setEditingRows({ ...editingRows, [id]: updated });
    }
  };

  const openParticipantModal = (rowId: string, isNew: boolean) => {
    let row = isNew ? newRows.find(r => r.id === rowId) : (editingRows[rowId] || programs.find(p => p.id === rowId));
    if (!row) return;
    
    // Auto-suggest logic if participants are empty
    let initialParts = row.participantIds || [];
    if (initialParts.length === 0 && row.category) {
       let targetDiv = "";
       if (row.category.toLowerCase().includes("judicial") || row.category.toLowerCase().includes("adjudication")) {
         targetDiv = "Adjudication Division";
       } else if (row.category.toLowerCase().includes("legal")) {
         targetDiv = "Legal Division";
       } else if (row.category.toLowerCase().includes("finance") || row.category.toLowerCase().includes("admin")) {
         targetDiv = "Administrative and Finance Division";
       }
       if (targetDiv) {
         initialParts = employees.filter(e => e.division === targetDiv).map(e => e.id);
       }
    }

    setParticipantModalData({
      rowId,
      isNew,
      max: row.maxParticipants,
      selectedIds: initialParts
    });
    setShowParticipantModal(rowId);
  };

  const handleSaveParticipants = () => {
    if (!participantModalData) return;
    const { rowId, isNew, selectedIds } = participantModalData;
    updateRow(rowId, "participantIds", selectedIds, isNew);
    setShowParticipantModal(null);
  };

  const openBreakdownModal = async (p: any) => {
    setBreakdownProgram(p);
    const res = await apiCall(`/api/training/liquidations?trainingProgramId=${p.id}`);
    if (res.status === "success") {
      setBreakdownData(res.breakdown || []);
      const sum = (res.breakdown || []).reduce((acc: number, curr: any) => acc + curr.total, 0);
      setBreakdownTotal(sum);
      setShowBreakdownModal(p.id);
    }
  };

  async function handleCreateLiquidation(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      trainingProgramId: selectedProgramId,
      expenseCategory,
      description: liqDesc,
      amount: liqAmount,
      dateIncurred: liqDate
    };
    const res = await apiCall("/api/training/liquidations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (res.status === "success") {
      setShowLiqModal(false);
      fetchData();
      triggerRefresh();
    } else {
      alert("Error: " + res.message);
    }
  }

  const renderRow = (p: any, isNew: boolean) => {
    const isEditing = isNew || !!editingRows[p.id];
    const row = isEditing ? (isNew ? p : editingRows[p.id]) : p;
    
    // For participants, if viewing, we show count. If editing, we show a button.
    const partsCount = isEditing ? (row.participantIds ? row.participantIds.length : 0) : participants.filter(part => part.trainingProgramId === p.id).length;

    return (
      <tr key={p.id} className={`border-b hover:bg-slate-50 ${isEditing ? 'bg-blue-50/30' : ''}`}>
        <td className="p-3">
          {isEditing ? (
            <input type="text" value={row.title} onChange={e => updateRow(p.id, "title", e.target.value, isNew)} className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white" placeholder="Title" />
          ) : (
            <div className="font-medium text-slate-800">{p.title}</div>
          )}
        </td>
        <td className="p-3 min-w-[200px]">
          {isEditing ? (
            <input type="text" value={row.description} onChange={e => updateRow(p.id, "description", e.target.value, isNew)} className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white" placeholder="Description" />
          ) : (
            <div className="text-sm text-slate-600 truncate max-w-[200px]">{p.description}</div>
          )}
        </td>
        <td className="p-3">
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <select value={row.category} onChange={e => updateRow(p.id, "category", e.target.value, isNew)} className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white">
                <option>Technical</option>
                <option>Leadership</option>
                <option>Administrative</option>
                <option>Legal/Judicial</option>
                <option>Mandatory</option>
              </select>
              <select value={row.targetDivision || ""} onChange={e => updateRow(p.id, "targetDivision", e.target.value, isNew)} className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-600">
                <option value="">-- No Target Division --</option>
                <option value="Administrative and Finance Division">Administrative and Finance Division</option>
                <option value="Legal Division">Legal Division</option>
                <option value="Adjudication Division">Adjudication Division</option>
                <option value="Technical Division">Technical Division</option>
              </select>
              <input type="text" value={row.targetSpecialization || ""} onChange={e => updateRow(p.id, "targetSpecialization", e.target.value, isNew)} className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-600" placeholder="Target Specialization..." />
            </div>
          ) : (
            <div className="flex flex-col gap-1 items-start">
              <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">{p.category}</span>
              {p.targetDivision && (
                <span className="text-[10px] text-slate-500 font-medium">Div: {p.targetDivision}</span>
              )}
              {p.targetSpecialization && (
                <span className="text-[10px] text-slate-500 font-medium">Spec: {p.targetSpecialization}</span>
              )}
            </div>
          )}
        </td>
        <td className="p-3">
          {isEditing ? (
            <input type="number" value={row.allocatedBudget} onChange={e => updateRow(p.id, "allocatedBudget", e.target.value, isNew)} className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white" placeholder="0.00" />
          ) : (
            <div className="font-medium">₱{Number(p.allocatedBudget).toLocaleString()}</div>
          )}
        </td>
        <td className="p-3 whitespace-nowrap">
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <input type="date" value={row.startDate} min={new Date().toISOString().split('T')[0]} onChange={e => updateRow(p.id, "startDate", e.target.value, isNew)} className="text-sm border border-slate-300 rounded px-2 py-1 bg-white w-32" />
                <input type="time" value={row.startTime} onChange={e => updateRow(p.id, "startTime", e.target.value, isNew)} className="text-sm border border-slate-300 rounded px-2 py-1 bg-white w-24" />
              </div>
              <div className="flex items-center gap-1">
                <input type="date" value={row.endDate} min={row.startDate || new Date().toISOString().split('T')[0]} onChange={e => updateRow(p.id, "endDate", e.target.value, isNew)} className={`text-sm border border-slate-300 rounded px-2 py-1 bg-white w-32 ${row.endDate && row.startDate && new Date(row.endDate) < new Date(row.startDate) ? 'border-red-500' : ''}`} />
                <input type="time" value={row.endTime} onChange={e => updateRow(p.id, "endTime", e.target.value, isNew)} className="text-sm border border-slate-300 rounded px-2 py-1 bg-white w-24" />
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              {p.startDate} {p.startTime} <br/>to {p.endDate} {p.endTime}
              <div className="mt-1 font-medium text-indigo-600">({p.totalHours} hrs)</div>
            </div>
          )}
        </td>
        <td className="p-3">
          {isEditing ? (
            <input type="text" value={row.facilitator} onChange={e => updateRow(p.id, "facilitator", e.target.value, isNew)} className="w-full text-sm border border-slate-300 rounded px-2 py-1 bg-white" placeholder="Facilitator" />
          ) : (
            <div className="text-sm text-slate-600 truncate max-w-[150px]">{p.facilitator || "N/A"}</div>
          )}
        </td>
        <td className="p-3">
           {isEditing ? (
             <div className="flex flex-col gap-1 items-start">
               <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                 Max: <input type="number" className="w-16 px-1 py-0.5 border border-slate-300 rounded" value={row.maxParticipants} onChange={e => updateRow(p.id, "maxParticipants", e.target.value, isNew)} />
               </div>
               <button onClick={() => openParticipantModal(p.id, isNew)} className="text-xs bg-white border border-slate-300 text-slate-700 px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1">
                 <Users size={12} /> {partsCount} Selected
               </button>
             </div>
           ) : (
             <div className="text-sm text-slate-600">
               <div className="mb-1 font-medium flex items-center gap-2">
                 {partsCount} / {p.maxParticipants}
                 {partsCount === 0 && (
                   <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                     <AlertTriangle size={10} /> Needs Participants
                   </span>
                 )}
               </div>
               {participants.filter(part => part.trainingProgramId === p.id).length > 0 && (
                 <div className="flex flex-wrap gap-1 mt-1">
                   {participants.filter(part => part.trainingProgramId === p.id).map(part => {
                     const emp = employees.find(e => e.id === part.employeeId);
                     return emp ? (
                       <span key={part.id} className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100 truncate max-w-[120px]" title={emp.fullName}>
                         {emp.fullName.split(' ')[0]}
                       </span>
                     ) : null;
                   })}
                 </div>
               )}
             </div>
           )}
        </td>
        <td className="p-3 whitespace-nowrap">
          {isEditing ? (
            <div className="flex gap-2">
              <button onClick={() => handleSaveRow(p.id, isNew)} className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100" title="Save">
                <Save size={16} />
              </button>
              <button onClick={() => handleDeleteProgram(p.id, isNew)} className="p-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100" title={isNew ? "Discard" : "Delete"}>
                <Trash2 size={16} />
              </button>
              {!isNew && (
                <button onClick={() => {
                  const updated = { ...editingRows };
                  delete updated[p.id];
                  setEditingRows(updated);
                }} className="p-1.5 text-slate-600 bg-slate-100 rounded hover:bg-slate-200" title="Cancel">
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => startEditing(p)} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100" title="Edit">
                <Edit2 size={16} />
              </button>
              <button onClick={() => openBreakdownModal(p)} className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Liquidation Breakdown">
                <PieChart size={16} />
              </button>
              <button onClick={() => handleDeleteProgram(p.id, false)} className="p-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Training Development Plan</h2>
          <p className="text-slate-500">Manage annual training programs and participants.</p>
        </div>
        <div className="flex gap-3">
          {user.role === UserRole.SUPER_ADMIN && (
            <button onClick={() => {
              setNewAnnualBudget(activeNewAnnual.toString());
              setShowBudgetModal(true);
            }} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2">
              <DollarSign size={18} /> Set Annual Budget
            </button>
          )}
          <button onClick={handleAddRow} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus size={18} /> Add Training Program
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Fiscal Year Budget ({activeFy?.label || "2026"})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Carry Over from FY {activeFy ? (Number(activeFy.label) - 1) : "2025"}</span>
            <span className="text-2xl font-bold text-teal-700">₱{activeCarryOver.toLocaleString()}</span>
          </div>
          <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">New Annual Budget</span>
            <span className="text-2xl font-bold text-blue-700">₱{activeNewAnnual.toLocaleString()}</span>
          </div>
          <div className="flex flex-col bg-blue-50 p-4 rounded-xl border border-blue-100">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Overall Total Budget</span>
            <span className="text-3xl font-extrabold text-slate-900">₱{activeBudget.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Allocated</p>
            <h3 className="text-2xl font-bold text-slate-800">₱{draftTotalAllocated.toLocaleString()}</h3>
          </div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm border p-6 flex items-center gap-4 ${remainingAnnualBudget < 0 ? 'border-red-500 bg-red-50' : (remainingAnnualBudget < 50000 ? 'border-orange-500 bg-orange-50' : 'border-slate-200')}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${remainingAnnualBudget < 0 ? 'bg-red-100 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
            {remainingAnnualBudget < 0 ? <AlertTriangle size={24} /> : <Target size={24} />}
          </div>
          <div>
            <p className={`text-sm font-medium mb-1 ${remainingAnnualBudget < 0 ? 'text-red-700' : 'text-slate-500'}`}>Remaining Budget</p>
            <h3 className={`text-2xl font-bold ${remainingAnnualBudget < 0 ? 'text-red-700' : 'text-slate-800'}`}>₱{remainingAnnualBudget.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-3 text-sm font-semibold text-slate-600">Training Title</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Description</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Category</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Allocated Budget</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Dates</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Facilitator</th>
                <th className="p-3 text-sm font-semibold text-slate-600">Participants</th>
                <th className="p-3 text-sm font-semibold text-slate-600 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {newRows.map(nr => renderRow(nr, true))}
              {activePrograms.length === 0 && newRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <BookOpen size={48} className="text-slate-300 mb-4" />
                      <p>No training programs found for this fiscal year.</p>
                      <button onClick={handleAddRow} className="mt-4 text-blue-600 hover:underline">Add one now</button>
                    </div>
                  </td>
                </tr>
              )}
              {activePrograms.map(p => renderRow(p, false))}
            </tbody>
          </table>
        </div>
      </div>

      {showParticipantModal && participantModalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Select Participants</h3>
              <button onClick={() => setShowParticipantModal(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 text-sm text-blue-800 bg-blue-50 p-3 rounded-lg flex gap-2">
                <Target size={18} className="shrink-0" />
                <p>
                  Based on the training category, we have auto-suggested participants. 
                  You can modify the selection below across all divisions. 
                  Maximum participants allowed: <strong>{participantModalData.max}</strong>
                  <br />Currently selected: <strong>{participantModalData.selectedIds.length}</strong>
                </p>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {["Adjudication Division", "Legal Division", "Administrative and Finance Division", "Office of the Executive Clerk of Court"].map(division => {
                  const divEmps = employees.filter(e => e.division === division || (!e.division && division === "Office of the Executive Clerk of Court"));
                  if (divEmps.length === 0) return null;
                  
                  return (
                    <div key={division} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-4 py-2 font-medium text-slate-700 text-sm">
                        {division}
                      </div>
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {divEmps.map(emp => {
                          let alreadyAssignedToTitle = "";
                          const existingAssignments = participants.filter(p => (p.employeeId === emp.id || p.employeeId === emp.employeeId) && p.trainingProgramId !== participantModalData.rowId && p.status !== "Cancelled");
                          const activeAssignment = existingAssignments.find(p => {
                            const pProg = programs.find(prog => prog.id === p.trainingProgramId);
                            return pProg && pProg.fiscalYear === activeFy?.label;
                          });
                          if (activeAssignment) {
                            alreadyAssignedToTitle = programs.find(p => p.id === activeAssignment.trainingProgramId)?.title || "Another Program";
                          }
                          const isAlreadyAssigned = !!alreadyAssignedToTitle;
                          const isChecked = participantModalData.selectedIds.includes(emp.id);
                          const isDisabled = isAlreadyAssigned || (!isChecked && participantModalData.selectedIds.length >= parseInt(participantModalData.max));

                          return (
                          <label key={emp.id} className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 border border-blue-200' : (isAlreadyAssigned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 border border-transparent')}`}>
                            <input 
                              type="checkbox" 
                              className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (participantModalData.selectedIds.length >= parseInt(participantModalData.max)) {
                                    alert(`You can only select up to ${participantModalData.max} participants.`);
                                    return;
                                  }
                                  setParticipantModalData({
                                    ...participantModalData,
                                    selectedIds: [...participantModalData.selectedIds, emp.id]
                                  });
                                } else {
                                  setParticipantModalData({
                                    ...participantModalData,
                                    selectedIds: participantModalData.selectedIds.filter((id: string) => id !== emp.id)
                                  });
                                }
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{emp.fullName}</p>
                              <p className="text-xs text-slate-500">{emp.position}</p>
                              {isAlreadyAssigned && <p className="text-xs text-red-500 font-semibold mt-1">Already assigned — {alreadyAssignedToTitle}</p>}
                            </div>
                          </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowParticipantModal(null)} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveParticipants} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirm Participants</button>
            </div>
          </div>
        </div>
      )}

      {showBreakdownModal && breakdownProgram && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Liquidation Expense Breakdown</h3>
              <button onClick={() => setShowBreakdownModal(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-700">{breakdownProgram.title}</h4>
                <p className="text-xs text-slate-500">Total Program Allocated Budget: ₱{Number(breakdownProgram.allocatedBudget).toLocaleString()}</p>
              </div>

              {breakdownData.length === 0 ? (
                <div className="text-center p-6 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg bg-slate-50">
                  <PieChart size={32} className="mx-auto text-slate-400 mb-2" />
                  <p>No liquidation expenses have been filed for this program yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-left text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-slate-600">Expense Category</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 text-right">Amount Liquidated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {breakdownData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{item.category}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">₱{Number(item.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-3 text-slate-800">Total Liquidated</td>
                        <td className="px-4 py-3 text-right text-blue-700">₱{Number(breakdownTotal).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Visual Bar representation */}
                  <div className="mt-6">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">Budget Utilization</h5>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full ${breakdownTotal > breakdownProgram.allocatedBudget ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, (breakdownTotal / breakdownProgram.allocatedBudget) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-slate-500">
                      <span>₱{Number(breakdownTotal).toLocaleString()} used</span>
                      <span>{((breakdownTotal / Math.max(1, breakdownProgram.allocatedBudget)) * 100).toFixed(1)}% of ₱{Number(breakdownProgram.allocatedBudget).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button onClick={() => setShowBreakdownModal(null)} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">Set New Annual Budget</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600"><Plus size={24} className="rotate-45" /></button>
            </div>
            <div className="p-6">
              <form id="budgetForm" onSubmit={handleSetAnnualBudget}>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Annual Budget (₱) *</label>
                <input required type="number" min="0" step="0.01" value={newAnnualBudget} onChange={e=>setNewAnnualBudget(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowBudgetModal(false)} className="px-4 py-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" form="budgetForm" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

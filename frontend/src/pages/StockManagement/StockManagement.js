import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FiPlus, FiArrowDown, FiArrowUp, FiAlertTriangle, FiPackage, FiList, FiBook } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './StockManagement.css';

const StockManagement = () => {
  const [activeTab, setActiveTab] = useState('materials');
  const [materials, setMaterials] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showStockIn, setShowStockIn] = useState(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [materialForm, setMaterialForm] = useState({ name: '', category: '', unit: 'kg', costPerUnit: 0, minStock: 0, barcode: '' });
  const [stockInForm, setStockInForm] = useState({ quantity: 0, costPerUnit: 0, invoiceNumber: '', batchNumber: '' });
  const [recipeForm, setRecipeForm] = useState({ menuItem: '', name: '', kitchenSection: 'kitchen', ingredients: [] });
  const [menuItems, setMenuItems] = useState([]);

  const fetchMaterials = useCallback(async () => {
    try { const res = await api.get('/stock/materials'); setMaterials(res.data.materials); } catch (e) { toast.error('Load failed'); }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try { const res = await api.get('/stock/recipes'); setRecipes(res.data.recipes); } catch (e) { console.error(e); }
  }, []);

  const fetchMovements = useCallback(async () => {
    try { const res = await api.get('/stock/movements'); setMovements(res.data.movements); } catch (e) { console.error(e); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try { const res = await api.get('/stock/alerts'); setStockAlerts(res.data.alerts); } catch (e) { console.error(e); }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try { const res = await api.get('/menu'); setMenuItems(res.data.items); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchMaterials(); fetchAlerts(); fetchMenuItems(); }, [fetchMaterials, fetchAlerts, fetchMenuItems]);

  useEffect(() => {
    if (activeTab === 'recipes') fetchRecipes();
    if (activeTab === 'movements') fetchMovements();
  }, [activeTab, fetchRecipes, fetchMovements]);

  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/materials', materialForm);
      toast.success('Material added');
      setShowForm(false);
      setMaterialForm({ name: '', category: '', unit: 'kg', costPerUnit: 0, minStock: 0, barcode: '' });
      fetchMaterials();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/stock-in', { materialId: showStockIn._id, ...stockInForm });
      toast.success('Stock added');
      setShowStockIn(null);
      setStockInForm({ quantity: 0, costPerUnit: 0, invoiceNumber: '', batchNumber: '' });
      fetchMaterials(); fetchAlerts();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleStockOut = async (materialId, quantity, reason) => {
    try {
      await api.post('/stock/stock-out', { materialId, quantity, reason });
      toast.success('Stock removed');
      fetchMaterials(); fetchAlerts();
    } catch (err) { toast.error(err.response?.data?.message || 'Insufficient stock'); }
  };

  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/recipes', recipeForm);
      toast.success('Recipe created');
      setShowRecipeForm(false);
      setRecipeForm({ menuItem: '', name: '', kitchenSection: 'kitchen', ingredients: [] });
      fetchRecipes();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const addIngredient = () => {
    setRecipeForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { rawMaterial: '', name: '', quantity: 0, unit: 'kg', wastagePercent: 0 }],
    }));
  };

  const updateIngredient = (idx, field, value) => {
    setRecipeForm(prev => {
      const ings = [...prev.ingredients];
      ings[idx] = { ...ings[idx], [field]: value };
      if (field === 'rawMaterial') {
        const m = materials.find(m => m._id === value);
        if (m) { ings[idx].name = m.name; ings[idx].unit = m.unit; }
      }
      return { ...prev, ingredients: ings };
    });
  };

  return (
    <div>
      <div className="page-header"><h1><FiPackage /> Stock Management</h1></div>

      <div className="report-tabs mb-24">
        {[
          { key: 'materials', icon: <FiPackage />, label: 'Raw Materials' },
          { key: 'recipes', icon: <FiBook />, label: 'Recipes / BOM' },
          { key: 'movements', icon: <FiList />, label: 'Stock Movements' },
          { key: 'alerts', icon: <FiAlertTriangle />, label: `Alerts (${stockAlerts.length})` },
        ].map(t => (
          <button key={t.key} className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'materials' && (
        <>
          <button className="btn btn-primary mb-16" onClick={() => setShowForm(!showForm)}><FiPlus /> Add Material</button>

          {showForm && (
            <div className="card mb-16">
              <form onSubmit={handleCreateMaterial}>
                <div className="grid-3 mb-16">
                  <div className="input-group"><label>Name *</label><input className="input" required value={materialForm.name} onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })} /></div>
                  <div className="input-group"><label>Category *</label><input className="input" required value={materialForm.category} onChange={e => setMaterialForm({ ...materialForm, category: e.target.value })} /></div>
                  <div className="input-group"><label>Unit</label><select className="input" value={materialForm.unit} onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })}><option value="kg">kg</option><option value="g">g</option><option value="litre">litre</option><option value="ml">ml</option><option value="pcs">pcs</option><option value="dozen">dozen</option></select></div>
                  <div className="input-group"><label>Cost/Unit (₹)</label><input className="input" type="number" value={materialForm.costPerUnit} onChange={e => setMaterialForm({ ...materialForm, costPerUnit: Number(e.target.value) })} /></div>
                  <div className="input-group"><label>Min Stock</label><input className="input" type="number" value={materialForm.minStock} onChange={e => setMaterialForm({ ...materialForm, minStock: Number(e.target.value) })} /></div>
                  <div className="input-group"><label>Barcode</label><input className="input" value={materialForm.barcode} onChange={e => setMaterialForm({ ...materialForm, barcode: e.target.value })} /></div>
                </div>
                <div className="flex gap-8"><button type="submit" className="btn btn-primary">Create</button><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
              </form>
            </div>
          )}

          {showStockIn && (
            <div className="card mb-16">
              <h4 className="mb-8">Stock In: {showStockIn.name}</h4>
              <form onSubmit={handleStockIn}>
                <div className="grid-4 mb-16">
                  <div className="input-group"><label>Quantity ({showStockIn.unit})</label><input className="input" type="number" step="0.01" required value={stockInForm.quantity} onChange={e => setStockInForm({ ...stockInForm, quantity: Number(e.target.value) })} /></div>
                  <div className="input-group"><label>Cost/Unit (₹)</label><input className="input" type="number" step="0.01" value={stockInForm.costPerUnit} onChange={e => setStockInForm({ ...stockInForm, costPerUnit: Number(e.target.value) })} /></div>
                  <div className="input-group"><label>Invoice #</label><input className="input" value={stockInForm.invoiceNumber} onChange={e => setStockInForm({ ...stockInForm, invoiceNumber: e.target.value })} /></div>
                  <div className="input-group"><label>Batch #</label><input className="input" value={stockInForm.batchNumber} onChange={e => setStockInForm({ ...stockInForm, batchNumber: e.target.value })} /></div>
                </div>
                <div className="flex gap-8"><button type="submit" className="btn btn-success"><FiArrowDown /> Add Stock</button><button type="button" className="btn btn-secondary" onClick={() => setShowStockIn(null)}>Cancel</button></div>
              </form>
            </div>
          )}

          <table className="table">
            <thead><tr><th>Material</th><th>Category</th><th>Stock</th><th>Unit</th><th>Cost/Unit</th><th>Min Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {materials.map(m => (
                <tr key={m._id} className={m.currentStock <= m.minStock ? 'row-warning' : ''}>
                  <td><strong>{m.name}</strong>{m.barcode && <small className="text-secondary ml-4">({m.barcode})</small>}</td>
                  <td>{m.category}</td>
                  <td><strong>{m.currentStock}</strong></td>
                  <td>{m.unit}</td>
                  <td>₹{m.costPerUnit}</td>
                  <td>{m.minStock}</td>
                  <td>{m.currentStock <= m.minStock ? <span className="badge badge-danger"><FiAlertTriangle /> Low</span> : <span className="badge badge-success">OK</span>}</td>
                  <td>
                    <div className="flex gap-4">
                      <button className="btn btn-sm btn-success" onClick={() => { setShowStockIn(m); setStockInForm({ ...stockInForm, costPerUnit: m.costPerUnit }); }}><FiArrowDown /> In</button>
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        const qty = prompt(`Stock out quantity (${m.unit}):`);
                        if (qty && Number(qty) > 0) handleStockOut(m._id, Number(qty), 'Manual stock out');
                      }}><FiArrowUp /> Out</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {activeTab === 'recipes' && (
        <>
          <button className="btn btn-primary mb-16" onClick={() => setShowRecipeForm(!showRecipeForm)}><FiPlus /> Create Recipe</button>

          {showRecipeForm && (
            <div className="card mb-16">
              <form onSubmit={handleCreateRecipe}>
                <div className="grid-3 mb-16">
                  <div className="input-group"><label>Menu Item *</label>
                    <select className="input" required value={recipeForm.menuItem} onChange={e => {
                      const item = menuItems.find(i => i._id === e.target.value);
                      setRecipeForm({ ...recipeForm, menuItem: e.target.value, name: item?.name || '' });
                    }}>
                      <option value="">Select item...</option>
                      {menuItems.map(i => <option key={i._id} value={i._id}>{i.name} ({i.category})</option>)}
                    </select>
                  </div>
                  <div className="input-group"><label>Recipe Name</label><input className="input" value={recipeForm.name} onChange={e => setRecipeForm({ ...recipeForm, name: e.target.value })} /></div>
                  <div className="input-group"><label>Kitchen Section</label>
                    <select className="input" value={recipeForm.kitchenSection} onChange={e => setRecipeForm({ ...recipeForm, kitchenSection: e.target.value })}>
                      <option value="kitchen">Kitchen</option><option value="bakery">Bakery</option><option value="bar">Bar</option><option value="desserts">Desserts</option>
                    </select>
                  </div>
                </div>
                <h4 className="mb-8">Ingredients</h4>
                {recipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} className="grid-4 mb-8">
                    <select className="input" value={ing.rawMaterial} onChange={e => updateIngredient(idx, 'rawMaterial', e.target.value)}>
                      <option value="">Select material...</option>
                      {materials.map(m => <option key={m._id} value={m._id}>{m.name} ({m.unit})</option>)}
                    </select>
                    <input className="input" type="number" step="0.01" placeholder="Quantity" value={ing.quantity} onChange={e => updateIngredient(idx, 'quantity', Number(e.target.value))} />
                    <input className="input" value={ing.unit} readOnly />
                    <input className="input" type="number" placeholder="Wastage %" value={ing.wastagePercent} onChange={e => updateIngredient(idx, 'wastagePercent', Number(e.target.value))} />
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm mb-16" onClick={addIngredient}><FiPlus /> Add Ingredient</button>
                <div className="flex gap-8"><button type="submit" className="btn btn-primary">Save Recipe</button><button type="button" className="btn btn-secondary" onClick={() => setShowRecipeForm(false)}>Cancel</button></div>
              </form>
            </div>
          )}

          <div className="grid-2">
            {recipes.map(r => (
              <div key={r._id} className="card">
                <h4>{r.name || r.menuItem?.name}</h4>
                <span className={`badge badge-${r.kitchenSection}`}>{r.kitchenSection}</span>
                <p className="text-secondary mt-4">Menu Item: {r.menuItem?.name} — ₹{r.menuItem?.price}</p>
                <p className="text-secondary">Estimated Cost: ₹{r.estimatedCost?.toFixed(2) || 'N/A'}</p>
                <div className="mt-8">
                  {r.ingredients?.map((ing, i) => (
                    <div key={i} className="text-secondary" style={{ fontSize: '0.85rem' }}>
                      • {ing.name || ing.rawMaterial?.name}: {ing.quantity} {ing.unit} {ing.wastagePercent > 0 ? `(+${ing.wastagePercent}% wastage)` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'movements' && (
        <table className="table">
          <thead><tr><th>Date</th><th>Material</th><th>Type</th><th>Qty</th><th>Previous</th><th>New</th><th>Cost</th><th>Reason</th><th>By</th></tr></thead>
          <tbody>
            {movements.map(m => (
              <tr key={m._id}>
                <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                <td>{m.rawMaterial?.name}</td>
                <td><span className={`badge badge-${m.type === 'in' ? 'success' : m.type === 'wastage' ? 'danger' : 'warning'}`}>{m.type.toUpperCase()}</span></td>
                <td>{m.quantity} {m.unit}</td>
                <td>{m.previousStock}</td>
                <td>{m.newStock}</td>
                <td>₹{m.totalCost?.toFixed(2)}</td>
                <td>{m.reason}</td>
                <td>{m.performedBy?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'alerts' && (
        <div>
          {stockAlerts.length === 0 ? <div className="empty-state"><p>All stock levels are healthy.</p></div> :
            stockAlerts.map(a => (
              <div key={a._id} className="alert-item severity-warning mb-8">
                <div>
                  <strong><FiAlertTriangle /> {a.name}</strong>
                  <p className="text-secondary">Current: {a.currentStock} {a.unit} | Minimum: {a.minStock} {a.unit}</p>
                </div>
                <button className="btn btn-sm btn-success" onClick={() => { setActiveTab('materials'); setShowStockIn(a); }}><FiArrowDown /> Stock In</button>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

export default StockManagement;

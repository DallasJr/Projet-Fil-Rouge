import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle, X, Tag, UtensilsCrossed, Filter, Search, ChevronDown } from 'lucide-react'
import { getCategories, getItems, createCategory, deleteCategory, createItem, updateItem, deleteItem } from '../api/menu.api'
import type { Category, Item } from '../api/menu.api'
import { uploadImage } from '../api/uploads.api'

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || ''

// Helper pour parser la description JSON (Uber Eats style)
interface RichDescription {
  desc?: string
  calories?: string
  prepTime?: string
  allergens?: string
}

const parseDescription = (rawDesc: string | null): RichDescription => {
  if (!rawDesc) return {}
  if (rawDesc.trim().startsWith('{')) {
    try {
      return JSON.parse(rawDesc)
    } catch {
      // Ignorer l'erreur et retourner comme description simple
    }
  }
  return { desc: rawDesc }
}

const AdminMenuPage = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [restaurantId, setRestaurantId] = useState(RESTAURANT_ID)
  const [tab, setTab] = useState<'items' | 'categories'>('items')

  // Modal état
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [showCatModal, setShowCatModal] = useState(false)

  // Formulaires
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    isAvailable: true,
    categoryId: '',
    calories: '',
    prepTime: '',
    allergens: ''
  })
  const [catForm, setCatForm] = useState({ name: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    setError('')
    try {
      const data = await uploadImage(file)
      setItemForm(f => ({ ...f, imageUrl: data.url }))
    } catch (err: any) {
      setError(err.response?.data?.error || "Erreur lors de l'upload de l'image.")
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === '' || item.categoryId === categoryFilter
    return matchesSearch && matchesCategory
  })

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3500)
  }

  const fetchAll = async () => {
    setIsLoading(true)
    try {
      const [cats, its] = await Promise.all([getCategories(), getItems()])
      setCategories(cats)
      setItems(its)
      if (cats.length > 0 && !restaurantId) setRestaurantId(cats[0].restaurantId)
    } catch {
      setError('Impossible de charger les données.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // ── Items ──
  const openCreateItem = () => {
    setEditingItem(null)
    setError('')
    setSuccess('')
    setItemForm({
      name: '',
      description: '',
      price: '',
      imageUrl: '',
      isAvailable: true,
      categoryId: categories[0]?.id || '',
      calories: '',
      prepTime: '',
      allergens: ''
    })
    setShowItemModal(true)
  }

  const openEditItem = (item: Item) => {
    setEditingItem(item)
    setError('')
    setSuccess('')
    const rich = parseDescription(item.description)
    setItemForm({
      name: item.name,
      description: rich.desc || '',
      price: String(item.price),
      imageUrl: item.imageUrl || '',
      isAvailable: item.isAvailable,
      categoryId: item.categoryId,
      calories: rich.calories || '',
      prepTime: rich.prepTime || '',
      allergens: rich.allergens || ''
    })
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) {
      setError('Nom, prix et catégorie sont obligatoires.')
      return
    }
    const parsedPrice = parseFloat(itemForm.price)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Le prix doit être un nombre supérieur à 0.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const payload = {
        name: itemForm.name,
        description: JSON.stringify({
          desc: itemForm.description,
          calories: itemForm.calories,
          prepTime: itemForm.prepTime,
          allergens: itemForm.allergens
        }),
        price: parsedPrice,
        imageUrl: itemForm.imageUrl || undefined,
        isAvailable: itemForm.isAvailable,
        categoryId: itemForm.categoryId,
      }
      if (editingItem) {
        await updateItem(editingItem.id, payload)
        showSuccess(`"${itemForm.name}" mis à jour.`)
      } else {
        await createItem(payload)
        showSuccess(`"${itemForm.name}" créé avec succès.`)
      }
      setShowItemModal(false)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteItem = async (item: Item) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return
    try {
      await deleteItem(item.id)
      showSuccess(`"${item.name}" supprimé.`)
      await fetchAll()
    } catch {
      setError('Impossible de supprimer ce plat.')
    }
  }

  const handleToggleAvailability = async (item: Item) => {
    try {
      await updateItem(item.id, { isAvailable: !item.isAvailable })
      showSuccess(`"${item.name}" est maintenant ${!item.isAvailable ? 'disponible' : 'indisponible'}.`)
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i))
    } catch {
      setError('Impossible de modifier la disponibilité.')
    }
  }

  // ── Catégories ──
  const handleCreateCategory = async () => {
    if (!catForm.name) { setError('Le nom est obligatoire.'); return }
    if (!restaurantId) { setError("Aucun restaurantId disponible. Vérifiez votre VITE_RESTAURANT_ID."); return }
    setIsSaving(true)
    setError('')
    try {
      await createCategory({ name: catForm.name, restaurantId })
      showSuccess(`Catégorie "${catForm.name}" créée.`)
      setCatForm({ name: '' })
      setShowCatModal(false)
      await fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Supprimer la catégorie "${cat.name}" et tous ses plats ?`)) return
    try {
      await deleteCategory(cat.id)
      showSuccess(`Catégorie "${cat.name}" supprimée.`)
      await fetchAll()
    } catch {
      setError('Impossible de supprimer cette catégorie.')
    }
  }

  if (isLoading) return <div className="loading-screen"><div className="loading-spinner"></div></div>

  return (
    <div className="admin-menu-page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Gestion du Menu</h1>
            <p className="page-subtitle">Créez et modifiez les plats et catégories</p>
          </div>
          <div className="action-buttons">
            {tab === 'items' ? (
              <button id="btn-add-item" className="btn btn-primary" onClick={openCreateItem} disabled={categories.length === 0}>
                <Plus size={16} /> Ajouter un plat
              </button>
            ) : (
              <button id="btn-add-category" className="btn btn-primary" onClick={() => { setError(''); setSuccess(''); setCatForm({ name: '' }); setShowCatModal(true) }}>
                <Plus size={16} /> Ajouter une catégorie
              </button>
            )}
          </div>
        </div>

        {/* ── Filtre collapsible (pattern uniforme) ── */}
        {tab === 'items' && (
          <div className="filter-panel" style={{ width: '100%', marginTop: '16px' }}>
            <div className="filter-panel-header" onClick={() => setShowFilters(v => !v)}>
              <span className="filter-panel-title">
                <Filter size={13} style={{ color: 'var(--color-primary)' }} /> Filtres &amp; Recherche
                {(searchTerm || categoryFilter) && (
                  <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--color-primary)', color: '#fff', fontWeight: '700', marginLeft: '6px' }}>
                    {[searchTerm && '1', categoryFilter && '1'].filter(Boolean).length}
                  </span>
                )}
              </span>
              <span className={`filter-panel-toggle ${showFilters ? 'open' : ''}`}>
                {showFilters ? 'Masquer' : 'Afficher'} <ChevronDown size={13} style={{ marginLeft: '4px' }} />
              </span>
            </div>
            {showFilters && (
              <div className="filter-panel-body">
                <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '180px' }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Recherche</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-dim)' }} />
                    <input type="text" className="form-input" placeholder="Rechercher un plat..." value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '30px', fontSize: '13px' }} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Catégorie</label>
                  <select className="form-input form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ fontSize: '13px', minWidth: '160px' }}>
                    <option value="">Toutes</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSearchTerm(''); setCategoryFilter('') }} style={{ height: '38px' }}>
                  Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {success && (
        <div className="alert alert-success"><CheckCircle size={16} /><span>{success}</span></div>
      )}
      {error && (
        <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>
      )}

      {/* Onglets */}
      <div className="tabs">
        <button id="tab-items" className={`tab-btn ${tab === 'items' ? 'active' : ''}`} onClick={() => setTab('items')}>
          <UtensilsCrossed size={15} /> Plats ({items.length})
        </button>
        <button id="tab-categories" className={`tab-btn ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>
          <Tag size={15} /> Catégories ({categories.length})
        </button>
      </div>

      {/* Table Items */}
      {tab === 'items' && (
        filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <h2>Aucun plat trouvé</h2>
            <p>Essayez d'ajuster vos critères de recherche ou vos filtres.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Plat</th>
                  <th>Catégorie</th>
                  <th>Prix</th>
                  <th>Disponible</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} id={`item-row-${item.id}`} style={{ opacity: item.isAvailable ? 1 : 0.55, transition: 'opacity 0.2s' }}>
                    <td>
                      <div className="item-cell">
                        <div style={{ position: 'relative' }}>
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} className="item-thumb" style={{ filter: item.isAvailable ? 'none' : 'grayscale(0.7)' }} />
                            : <div className="item-thumb-placeholder" style={{ filter: item.isAvailable ? 'none' : 'grayscale(0.7)' }}>🍽️</div>
                          }
                          {!item.isAvailable && (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.45)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '9px', fontWeight: '700', color: '#ef4444', background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>OFF</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="item-name" style={{ color: item.isAvailable ? undefined : '#94a3b8' }}>{item.name}</div>
                          {item.description && (
                            <div className="text-muted text-sm">
                              {(() => {
                                const rich = parseDescription(item.description)
                                return (
                                  <>
                                    {rich.desc && <span style={{ display: 'block' }}>{rich.desc}</span>}
                                    <span style={{ display: 'flex', gap: '8px', fontSize: '11px', marginTop: '2px', color: '#64748b', flexWrap: 'wrap' }}>
                                      {rich.prepTime && <span>⏱️ {rich.prepTime} min</span>}
                                      {rich.calories && <span>🔥 {rich.calories} kcal</span>}
                                      {rich.allergens && <span>⚠️ Allergènes: {rich.allergens}</span>}
                                    </span>
                                  </>
                                )
                              })()}
                            </div>
                          )}
                          {!item.isAvailable && (
                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600', display: 'block', marginTop: '2px' }}>Non visible sur le menu client</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td><span className="filter-chip active" style={{ fontSize: '0.75rem' }}>{item.category?.name}</span></td>
                    <td><strong style={{ color: item.isAvailable ? undefined : '#94a3b8' }}>{item.price.toFixed(2)} €</strong></td>
                    <td>
                      {/* Toggle switch rapide */}
                      <button
                        id={`toggle-available-${item.id}`}
                        title={item.isAvailable ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                        onClick={() => handleToggleAvailability(item)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '7px',
                          padding: '5px 10px', borderRadius: '20px', border: 'none',
                          cursor: 'pointer', fontWeight: '600', fontSize: '12px',
                          background: item.isAvailable ? '#dcfce7' : '#f1f5f9',
                          color: item.isAvailable ? '#15803d' : '#64748b',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                      >
                        <span style={{
                          width: '26px', height: '14px', borderRadius: '7px', display: 'inline-block', position: 'relative',
                          background: item.isAvailable ? '#16a34a' : '#cbd5e1',
                          transition: 'background 0.2s', flexShrink: 0,
                        }}>
                          <span style={{
                            position: 'absolute', top: '2px',
                            left: item.isAvailable ? '13px' : '2px',
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: '#fff', transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </span>
                        {item.isAvailable ? 'Disponible' : 'Désactivé'}
                      </button>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button id={`edit-item-${item.id}`} className="btn btn-secondary btn-sm" onClick={() => openEditItem(item)}>
                          <Pencil size={13} /> Modifier
                        </button>
                        <button id={`delete-item-${item.id}`} className="btn btn-danger btn-sm" onClick={() => handleDeleteItem(item)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Table Catégories */}
      {tab === 'categories' && (
        categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <h2>Aucune catégorie</h2>
            <p>Créez votre première catégorie pour commencer.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Nombre de plats</th>
                  <th>Ordre</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} id={`cat-row-${cat.id}`}>
                    <td><strong>{cat.name}</strong></td>
                    <td>{cat.items?.length ?? items.filter(i => i.categoryId === cat.id).length} plats</td>
                    <td>{cat.displayOrder}</td>
                    <td>
                      <button id={`delete-cat-${cat.id}`} className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(cat)}>
                        <Trash2 size={13} /> Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal — Ajouter/Modifier un plat */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingItem ? 'Modifier le plat' : 'Nouveau plat'}</h2>
              <button className="btn-icon" onClick={() => setShowItemModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><AlertCircle size={14}/><span>{error}</span></div>}
              <div className="form-group">
                <label className="form-label">Nom du plat *</label>
                <input id="item-name" className="form-input" type="text" placeholder="Ex: Burger Classic" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea id="item-description" className="form-input" placeholder="Description courte du plat..." value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Calories (kcal)</label>
                  <input id="item-calories" className="form-input" type="number" placeholder="Ex: 500" value={itemForm.calories} onChange={e => setItemForm(f => ({ ...f, calories: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Temps prép (min)</label>
                  <input id="item-prep" className="form-input" type="number" placeholder="Ex: 15" value={itemForm.prepTime} onChange={e => setItemForm(f => ({ ...f, prepTime: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Allergènes (séparés par des virgules)</label>
                <input id="item-allergens" className="form-input" type="text" placeholder="Ex: Gluten, Lactose" value={itemForm.allergens} onChange={e => setItemForm(f => ({ ...f, allergens: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prix (€) *</label>
                  <input id="item-price" className="form-input" type="number" step="0.01" min="0" placeholder="0.00" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Catégorie *</label>
                  <select id="item-category" className="form-input form-select" value={itemForm.categoryId} onChange={e => setItemForm(f => ({ ...f, categoryId: e.target.value }))}>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Image (Saisir URL ou Uploader un fichier)</label>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <input
                    id="item-image"
                    className="form-input"
                    type="url"
                    placeholder="https://..."
                    value={itemForm.imageUrl}
                    onChange={e => setItemForm(f => ({ ...f, imageUrl: e.target.value }))}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isUploadingImage}
                      style={{ fontSize: '14px' }}
                    />
                    {isUploadingImage && <span className="btn-spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>}
                  </div>
                  {itemForm.imageUrl && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={itemForm.imageUrl} alt="Aperçu" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '4px', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>
              <label className="toggle-label">
                <input id="item-available" type="checkbox" checked={itemForm.isAvailable} onChange={e => setItemForm(f => ({ ...f, isAvailable: e.target.checked }))} />
                <span className="toggle-text">Disponible à la commande</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowItemModal(false)}>Annuler</button>
              <button id="btn-save-item" className="btn btn-primary" onClick={handleSaveItem} disabled={isSaving}>
                {isSaving ? <span className="btn-spinner"></span> : (editingItem ? 'Enregistrer' : 'Créer le plat')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Nouvelle catégorie */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle catégorie</h2>
              <button className="btn-icon" onClick={() => setShowCatModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><AlertCircle size={14}/><span>{error}</span></div>}
              <div className="form-group">
                <label className="form-label">Nom de la catégorie *</label>
                <input id="cat-name" className="form-input" type="text" placeholder="Ex: Burgers, Pizzas, Desserts..." value={catForm.name} onChange={e => setCatForm({ name: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCatModal(false)}>Annuler</button>
              <button id="btn-save-category" className="btn btn-primary" onClick={handleCreateCategory} disabled={isSaving}>
                {isSaving ? <span className="btn-spinner"></span> : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminMenuPage

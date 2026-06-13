import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, AlertCircle, CheckCircle, X, Tag, UtensilsCrossed, UploadCloud } from 'lucide-react'
import { getCategories, getItems, createCategory, deleteCategory, createItem, updateItem, deleteItem } from '../api/menu.api'
import { uploadImage } from '../api/uploads.api'
import type { Category, Item } from '../api/menu.api'

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || ''

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
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', imageUrl: '', isAvailable: true, categoryId: '' })
  const [catForm, setCatForm] = useState({ name: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

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
    setItemForm({ name: '', description: '', price: '', imageUrl: '', isAvailable: true, categoryId: categories[0]?.id || '' })
    setShowItemModal(true)
  }

  const openEditItem = (item: Item) => {
    setEditingItem(item)
    setItemForm({ name: item.name, description: item.description || '', price: String(item.price), imageUrl: item.imageUrl || '', isAvailable: item.isAvailable, categoryId: item.categoryId })
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) {
      setError('Nom, prix et catégorie sont obligatoires.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const payload = {
        name: itemForm.name,
        description: itemForm.description || undefined,
        price: parseFloat(itemForm.price),
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

  const handleImageUpload = async (file: File | null) => {
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Format image non supporte. Utilisez JPG, PNG, WEBP ou GIF.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image trop volumineuse. Taille maximale: 5 Mo.')
      return
    }

    setIsUploadingImage(true)
    setError('')
    try {
      const uploaded = await uploadImage(file)
      setItemForm((form) => ({ ...form, imageUrl: uploaded.url }))
      showSuccess('Image envoyee vers le stockage cloud.')
    } catch (err: any) {
      setError(err.response?.data?.error || "Impossible d'uploader cette image.")
    } finally {
      setIsUploadingImage(false)
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
      <div className="page-header">
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
            <button id="btn-add-category" className="btn btn-primary" onClick={() => setShowCatModal(true)}>
              <Plus size={16} /> Ajouter une catégorie
            </button>
          )}
        </div>
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
        items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <h2>Aucun plat dans le menu</h2>
            <p>Commencez par créer des catégories, puis ajoutez vos plats.</p>
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
                {items.map((item) => (
                  <tr key={item.id} id={`item-row-${item.id}`}>
                    <td>
                      <div className="item-cell">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="item-thumb" />
                          : <div className="item-thumb-placeholder">🍽️</div>
                        }
                        <div>
                          <div className="item-name">{item.name}</div>
                          {item.description && <div className="text-muted text-sm">{item.description.slice(0, 50)}{item.description.length > 50 ? '…' : ''}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="filter-chip active" style={{ fontSize: '0.75rem' }}>{item.category?.name}</span></td>
                    <td><strong>{item.price.toFixed(2)} €</strong></td>
                    <td>
                      <span className={`status-badge ${item.isAvailable ? 'status-delivered' : 'status-cancelled'}`}>
                        {item.isAvailable ? '✓ Dispo' : '✗ Indispo'}
                      </span>
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
                <label className="form-label">Image (optionnel)</label>
                <div className="image-upload-field">
                  {itemForm.imageUrl
                    ? <img src={itemForm.imageUrl} alt={itemForm.name || 'Apercu du plat'} className="image-upload-preview" />
                    : <div className="image-upload-placeholder"><UploadCloud size={20} /></div>
                  }
                  <div className="image-upload-controls">
                    <label className="btn btn-secondary btn-sm" htmlFor="item-image-file">
                      <UploadCloud size={13} /> {isUploadingImage ? 'Upload...' : 'Choisir une image'}
                    </label>
                    <input
                      id="item-image-file"
                      className="visually-hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={isUploadingImage}
                      onChange={e => handleImageUpload(e.target.files?.[0] || null)}
                    />
                    {itemForm.imageUrl && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItemForm(f => ({ ...f, imageUrl: '' }))}>
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
                <input id="item-image" className="form-input" type="url" placeholder="https://..." value={itemForm.imageUrl} onChange={e => setItemForm(f => ({ ...f, imageUrl: e.target.value }))} />
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

import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, ScrollView, Switch, RefreshControl, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import {
  getCategories, getItems, createCategory, deleteCategory,
  createItem, updateItem, deleteItem, Category, Item,
} from '../../api/menu'

type AdminTab = 'categories' | 'items'

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
      // Return as simple description
    }
  }
  return { desc: rawDesc }
}

const EMPTY_ITEM = {
  name: '', description: '', price: '', imageUrl: '', isAvailable: true, categoryId: '',
  calories: '', prepTime: '', allergens: '',
}

export default function AdminMenuScreen() {
  const navigation = useNavigation()
  const [activeTab, setActiveTab] = useState<AdminTab>('items')
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Item form
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM })
  const [saving, setSaving] = useState(false)

  // Category form
  const [showCatModal, setShowCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  const loadData = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true)
    try {
      const [cats, its] = await Promise.all([getCategories(), getItems()])
      setCategories(cats)
      setItems(its)
    } catch (err) {
      console.error('Error loading menu admin:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  const onRefresh = () => { setRefreshing(true); loadData(false) }

  const openCreateItem = () => {
    setEditingItem(null)
    setItemForm({ ...EMPTY_ITEM, categoryId: categories[0]?.id || '' })
    setShowItemModal(true)
  }

  const openEditItem = (item: Item) => {
    setEditingItem(item)
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
      allergens: rich.allergens || '',
    })
    setShowItemModal(true)
  }

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price || !itemForm.categoryId) {
      Alert.alert('Champs requis', 'Nom, prix et catégorie sont obligatoires.')
      return
    }
    const priceVal = parseFloat(itemForm.price)
    if (isNaN(priceVal) || priceVal <= 0) {
      Alert.alert('Prix invalide', 'Veuillez entrer un prix valide.')
      return
    }
    setSaving(true)
    
    // Construct rich description
    const isRich = itemForm.calories || itemForm.prepTime || itemForm.allergens
    const descriptionPayload = isRich
      ? JSON.stringify({
          desc: itemForm.description,
          calories: itemForm.calories,
          prepTime: itemForm.prepTime,
          allergens: itemForm.allergens,
        })
      : itemForm.description

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          name: itemForm.name,
          description: descriptionPayload || null,
          price: priceVal,
          imageUrl: itemForm.imageUrl || null,
          isAvailable: itemForm.isAvailable,
          categoryId: itemForm.categoryId,
        })
      } else {
        await createItem({
          name: itemForm.name,
          description: descriptionPayload,
          price: priceVal,
          imageUrl: itemForm.imageUrl,
          isAvailable: itemForm.isAvailable,
          categoryId: itemForm.categoryId,
        })
      }
      setShowItemModal(false)
      loadData(false)
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le plat.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = (item: Item) => {
    Alert.alert('Supprimer', `Supprimer "${item.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try { await deleteItem(item.id); loadData(false) }
          catch { Alert.alert('Erreur', 'Impossible de supprimer ce plat.') }
        },
      },
    ])
  }

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) { Alert.alert('Champs requis', 'Nom de catégorie requis.'); return }
    if (categories.length === 0) { Alert.alert('Erreur', 'Aucun restaurant trouvé.'); return }
    setSavingCat(true)
    try {
      await createCategory({ name: newCatName, restaurantId: categories[0].restaurantId })
      setShowCatModal(false)
      setNewCatName('')
      loadData(false)
    } catch {
      Alert.alert('Erreur', 'Impossible de créer la catégorie.')
    } finally {
      setSavingCat(false)
    }
  }

  const handleDeleteCategory = (cat: Category) => {
    Alert.alert('Supprimer', `Supprimer la catégorie "${cat.name}" et tous ses plats ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try { await deleteCategory(cat.id); loadData(false) }
          catch { Alert.alert('Erreur', 'Impossible de supprimer la catégorie.') }
        },
      },
    ])
  }

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name || '—'

  const renderItemCard = ({ item }: { item: Item }) => {
    const rich = parseDescription(item.description)
    return (
      <View style={styles.itemCard}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Text style={{ fontSize: 20 }}>🍽️</Text>
          </View>
        )}
        
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {rich.desc ? <Text style={styles.itemDescription} numberOfLines={1}>{rich.desc}</Text> : null}
          
          <View style={styles.metaBadgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{getCatName(item.categoryId)}</Text>
            </View>
            <Text style={styles.itemPrice}>{item.price.toFixed(2)} €</Text>
            <View style={[styles.availBadge, item.isAvailable ? styles.availGreen : styles.availRed]}>
              <Text style={styles.availText}>{item.isAvailable ? 'Disponible' : 'Indisponible'}</Text>
            </View>
          </View>

          {/* Uber eats style metadata list */}
          {(rich.prepTime || rich.calories || rich.allergens) && (
            <View style={styles.richMetaTags}>
              {rich.prepTime && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>⏱️ {rich.prepTime} min</Text>
                </View>
              )}
              {rich.calories && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>⚡ {rich.calories} kcal</Text>
                </View>
              )}
              {rich.allergens && (
                <View style={[styles.metaChip, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                  <Text style={[styles.metaChipText, { color: '#ef4444' }]}>⚠️ {rich.allergens}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        <View style={styles.rowBtns}>
          <TouchableOpacity style={styles.editBtn} onPress={() => openEditItem(item)}>
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteItem(item)}>
            <Text style={styles.delBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion Menu</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => activeTab === 'items' ? openCreateItem() : setShowCatModal(true)}
        >
          <Text style={styles.createBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabs}>
        {(['items', 'categories'] as AdminTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'items' ? `🍔 Plats (${items.length})` : `📂 Catégories (${categories.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#f97316" /></View>
      ) : activeTab === 'items' ? (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Aucun plat</Text></View>}
          renderItem={renderItemCard}
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>Aucune catégorie</Text></View>}
          renderItem={({ item: cat }) => {
            const count = items.filter(i => i.categoryId === cat.id).length
            return (
              <View style={styles.itemCard}>
                <View style={styles.categoryInfoBox}>
                  <Text style={styles.categoryNameText}>📂 {cat.name}</Text>
                  <Text style={styles.categorySubText}>{count} plat(s) • Ordre : {cat.displayOrder}</Text>
                </View>
                <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteCategory(cat)}>
                  <Text style={styles.delBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}

      {/* Item Modal */}
      <Modal visible={showItemModal} animationType="slide" onRequestClose={() => setShowItemModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingItem ? 'Modifier le plat' : 'Nouveau plat'}</Text>
            <TouchableOpacity onPress={() => setShowItemModal(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput style={styles.fieldInput} value={itemForm.name} onChangeText={v => setItemForm(f => ({ ...f, name: v }))} placeholder="Ex: Burger Gourmet" placeholderTextColor="#475569" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={[styles.fieldInput, { minHeight: 60, textAlignVertical: 'top' }]} value={itemForm.description} onChangeText={v => setItemForm(f => ({ ...f, description: v }))} placeholder="Description du plat..." placeholderTextColor="#475569" multiline />
            </View>
            
            {/* Uber Eats Rich Stats */}
            <View style={styles.metaFormRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Calories (kcal)</Text>
                <TextInput style={styles.fieldInput} value={itemForm.calories} onChangeText={v => setItemForm(f => ({ ...f, calories: v }))} placeholder="Ex: 650" placeholderTextColor="#475569" keyboardType="numeric" />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Préparation (min)</Text>
                <TextInput style={styles.fieldInput} value={itemForm.prepTime} onChangeText={v => setItemForm(f => ({ ...f, prepTime: v }))} placeholder="Ex: 15" placeholderTextColor="#475569" keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Allergènes</Text>
              <TextInput style={styles.fieldInput} value={itemForm.allergens} onChangeText={v => setItemForm(f => ({ ...f, allergens: v }))} placeholder="Ex: gluten, lactose, oeufs" placeholderTextColor="#475569" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Prix (€) *</Text>
              <TextInput style={styles.fieldInput} value={itemForm.price} onChangeText={v => setItemForm(f => ({ ...f, price: v }))} placeholder="12.50" placeholderTextColor="#475569" keyboardType="decimal-pad" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>URL Image</Text>
              <TextInput style={styles.fieldInput} value={itemForm.imageUrl} onChangeText={v => setItemForm(f => ({ ...f, imageUrl: v }))} placeholder="https://..." placeholderTextColor="#475569" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }} contentContainerStyle={{ gap: 8 }}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, itemForm.categoryId === cat.id && styles.catChipActive]}
                    onPress={() => setItemForm(f => ({ ...f, categoryId: cat.id }))}
                  >
                    <Text style={[styles.catChipText, itemForm.categoryId === cat.id && styles.catChipTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Disponible</Text>
              <Switch
                value={itemForm.isAvailable}
                onValueChange={v => setItemForm(f => ({ ...f, isAvailable: v }))}
                trackColor={{ false: '#334155', true: '#f97316' }}
                thumbColor={itemForm.isAvailable ? '#fff' : '#94a3b8'}
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveItem} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{editingItem ? 'Sauvegarder' : 'Créer le plat'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCatModal} animationType="slide" onRequestClose={() => setShowCatModal(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle Catégorie</Text>
            <TouchableOpacity onPress={() => setShowCatModal(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput style={styles.fieldInput} value={newCatName} onChangeText={setNewCatName} placeholder="Ex: Burgers" placeholderTextColor="#475569" />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveCategory} disabled={savingCat}>
              {savingCat ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Créer la catégorie</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748b', fontSize: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backText: { color: '#f97316', fontWeight: '800', fontSize: 15 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#f1f5f9' },
  createBtn: { backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#f97316' },
  tabText: { color: '#64748b', fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#f97316' },
  itemCard: {
    backgroundColor: '#151821', borderRadius: 14, padding: 12, flexDirection: 'row',
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 12,
  },
  itemImage: {
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  itemImagePlaceholder: {
    width: 64, height: 64, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  itemInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  itemName: { color: '#f1f5f9', fontWeight: '800', fontSize: 14 },
  itemDescription: { color: '#64748b', fontSize: 11 },
  metaBadgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  categoryBadge: {
    backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
  },
  categoryBadgeText: { color: '#f97316', fontSize: 10, fontWeight: '700' },
  itemPrice: { color: '#f59e0b', fontWeight: '800', fontSize: 13 },
  availBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  availGreen: { backgroundColor: 'rgba(34,197,94,0.12)' },
  availRed: { backgroundColor: 'rgba(239,68,68,0.12)' },
  availText: { fontSize: 10, fontWeight: '700', color: '#f1f5f9' },
  
  richMetaTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  metaChipText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  categoryInfoBox: { flex: 1, gap: 2 },
  categoryNameText: { color: '#f1f5f9', fontWeight: '800', fontSize: 14 },
  categorySubText: { color: '#64748b', fontSize: 12 },

  rowBtns: { gap: 8, justifyContent: 'center' },
  editBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(249,115,22,0.1)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
  },
  editBtnText: { fontSize: 13 },
  delBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  delBtnText: { fontSize: 13 },
  modal: { flex: 1, backgroundColor: '#0d0f14' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#f1f5f9' },
  closeBtn: { fontSize: 20, color: '#64748b' },
  modalBody: { padding: 20, gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  fieldInput: {
    backgroundColor: '#151821', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 12, fontSize: 14, color: '#f1f5f9',
  },
  metaFormRow: { flexDirection: 'row', gap: 10 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#151821', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  catChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  catChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  submitBtn: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
})

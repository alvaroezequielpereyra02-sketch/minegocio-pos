/**
 * src/hooks/useInventory.js — Fase 2A
 *
 * Reemplaza los listeners de Firestore (onSnapshot) por TanStack Query.
 * La actualización "en vivo" ahora es polling (cada 15s, configurado en
 * src/lib/queryClient.js) en vez de push en tiempo real — para el tamaño
 * de este negocio es indistinguible en la práctica y muchísimo más simple
 * de mantener.
 *
 * La forma del objeto que devuelve este hook es intencionalmente idéntica
 * a la versión anterior (mismos nombres, misma firma de cada función) para
 * no tener que tocar los componentes que ya lo consumen.
 *
 * Cambio de alcance respecto a la versión anterior: `generateInvitationCode`
 * ya NO vive acá — quedó reemplazado por el sistema de invitaciones de la
 * Fase 1 (`authService.createInvite`). Ver FASE_2A_APPMODALS_PATCH.md.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { productsService }                        from '../services/products.js';
import { categoriesService, subcategoriesService } from '../services/categories.js';
import { customersService }                        from '../services/customers.js';
import { expensesService }                         from '../services/expenses.js';
import { storeService }                             from '../services/store.js';

// Categorías, subcategorías y perfil de tienda cambian poco — no hace
// falta el polling agresivo de 15s del resto de los datos.
const LOW_CHURN = { refetchInterval: false, staleTime: 5 * 60 * 1000 };

export const useInventory = (user, userData) => {
  const queryClient = useQueryClient();
  const isAdmin = userData?.role === 'admin';

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsService.getAll(),
    enabled:  !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn:  categoriesService.getAll,
    enabled:  !!user,
    ...LOW_CHURN,
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn:  () => subcategoriesService.getAll(),
    enabled:  !!user,
    ...LOW_CHURN,
  });

  const { data: storeProfile = { name: 'MiNegocio', logoUrl: '' } } = useQuery({
    queryKey: ['storeProfile'],
    queryFn:  storeService.getProfile,
    enabled:  !!user,
    ...LOW_CHURN,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn:  () => customersService.getAll(),
    enabled:  !!user && isAdmin,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn:  () => expensesService.getAll(),
    enabled:  !!user && isAdmin,
  });

  // ── Helper para mutaciones repetitivas ──────────────────────────────────

  const invalidate = (key) => queryClient.invalidateQueries({ queryKey: [key] });

  // ── Productos ────────────────────────────────────────────────────────────

  const addProductMutation    = useMutation({ mutationFn: productsService.create, onSuccess: () => invalidate('products') });
  const updateProductMutation = useMutation({ mutationFn: ({ id, data }) => productsService.update(id, data), onSuccess: () => invalidate('products') });
  const deleteProductMutation = useMutation({ mutationFn: productsService.delete, onSuccess: () => invalidate('products') });
  const addStockMutation      = useMutation({ mutationFn: ({ product, qty }) => productsService.addStock(product.id, qty), onSuccess: () => invalidate('products') });
  const faultyMutation        = useMutation({ mutationFn: ({ product, qty, reason }) => productsService.registerFaulty(product.id, qty, reason), onSuccess: () => { invalidate('products'); invalidate('expenses'); } });
  const bulkPriceMutation     = useMutation({ mutationFn: ({ categoryId, priceConfig }) => productsService.bulkPrice(categoryId, priceConfig), onSuccess: () => invalidate('products') });

  const addProduct    = (data)        => addProductMutation.mutateAsync(data);
  const updateProduct = (id, data)    => updateProductMutation.mutateAsync({ id, data });
  const deleteProduct = (id)          => deleteProductMutation.mutateAsync(id);
  const addStock       = (product, qty) => addStockMutation.mutateAsync({ product, qty });
  const registerFaultyProduct = (product, qty, reason) => faultyMutation.mutateAsync({ product, qty, reason });
  const bulkUpdatePrices = (categoryId, priceConfig) => bulkPriceMutation.mutateAsync({ categoryId, priceConfig });

  // ── Categorías ───────────────────────────────────────────────────────────

  const addCategoryMutation    = useMutation({ mutationFn: categoriesService.create, onSuccess: () => invalidate('categories') });
  const updateCategoryMutation = useMutation({ mutationFn: ({ id, data }) => categoriesService.update(id, data?.name), onSuccess: () => invalidate('categories') });
  const deleteCategoryMutation = useMutation({ mutationFn: categoriesService.delete, onSuccess: () => invalidate('categories') });

  const addCategory    = (name)     => addCategoryMutation.mutateAsync(name);
  const updateCategory = (id, data) => updateCategoryMutation.mutateAsync({ id, data });
  const deleteCategory = (id)       => deleteCategoryMutation.mutateAsync(id);

  // ── Subcategorías ────────────────────────────────────────────────────────

  const addSubCategoryMutation    = useMutation({ mutationFn: ({ parentId, name }) => subcategoriesService.create(parentId, name), onSuccess: () => invalidate('subcategories') });
  const deleteSubCategoryMutation = useMutation({ mutationFn: subcategoriesService.delete, onSuccess: () => invalidate('subcategories') });

  const addSubCategory    = (parentId, name) => addSubCategoryMutation.mutateAsync({ parentId, name });
  const deleteSubCategory = (id)             => deleteSubCategoryMutation.mutateAsync(id);

  // ── Clientes (libreta del POS) ───────────────────────────────────────────

  const addCustomerMutation    = useMutation({ mutationFn: customersService.create, onSuccess: () => invalidate('customers') });
  const updateCustomerMutation = useMutation({ mutationFn: ({ id, data }) => customersService.update(id, data), onSuccess: () => invalidate('customers') });
  const deleteCustomerMutation = useMutation({ mutationFn: customersService.delete, onSuccess: () => invalidate('customers') });

  const addCustomer    = (data)     => addCustomerMutation.mutateAsync(data);
  const updateCustomer = (id, data) => updateCustomerMutation.mutateAsync({ id, data });
  const deleteCustomer = (id)       => deleteCustomerMutation.mutateAsync(id);

  // ── Gastos ───────────────────────────────────────────────────────────────

  const addExpenseMutation    = useMutation({ mutationFn: expensesService.create, onSuccess: () => invalidate('expenses') });
  const deleteExpenseMutation = useMutation({ mutationFn: expensesService.delete, onSuccess: () => invalidate('expenses') });

  const addExpense    = (data) => addExpenseMutation.mutateAsync(data);
  const deleteExpense = (id)   => deleteExpenseMutation.mutateAsync(id);

  // ── Perfil de tienda ─────────────────────────────────────────────────────

  const updateStoreProfileMutation = useMutation({ mutationFn: storeService.updateProfile, onSuccess: () => invalidate('storeProfile') });
  const updateStoreProfile = (data) => updateStoreProfileMutation.mutateAsync(data);

  return {
    products, categories, subcategories, customers, expenses, storeProfile,
    addProduct, updateProduct, deleteProduct, addStock, registerFaultyProduct, bulkUpdatePrices,
    addCategory, updateCategory, deleteCategory,
    addSubCategory, deleteSubCategory,
    addCustomer, updateCustomer, deleteCustomer,
    addExpense, deleteExpense,
    updateStoreProfile,
  };
};

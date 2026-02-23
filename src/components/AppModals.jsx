import React from 'react';
import {
    ExpenseModal, ProductModal, CategoryModal, CustomerModal,
    StoreModal, AddStockModal, TransactionModal, LogoutConfirmModal,
    InvitationModal, ConfirmModal, FaultyProductModal,
} from './Modals';

/**
 * AppModals
 * Renderiza todos los modales de la aplicación en un único lugar.
 * Recibe el estado y los handlers desde App.jsx vía props.
 */
export default function AppModals({
    modals,
    toggleModal,
    confirmConfig,
    // Producto
    editingProduct,
    imageMode,       setImageMode,
    previewImage,    setPreviewImage,
    handleFileChange,
    handleSaveProductWrapper,
    categories,
    subcategories,
    setFaultyProduct,
    deleteProduct,
    requestConfirm,
    // Categoría
    addSubCategory,
    deleteSubCategory,
    updateCategory,
    deleteCategory,
    addCategory,
    // Cliente
    editingCustomer,
    handleSaveCustomer,
    // Tienda
    storeProfile,
    handleSaveStore,
    // Stock
    scannedProduct,
    setScannedProduct,
    handleAddStock,
    quantityInputRef,
    // Transacción
    editingTransaction,
    handleSaveTransaction,
    // Logout
    handleConfirmLogout,
    // Invitación
    generateInvitationCode,
    // Producto fallado
    faultyProduct,
    handleConfirmFaulty,
    // Gasto
    handleSaveExpense,
}) {
    return (
        <>
            {confirmConfig && <ConfirmModal {...confirmConfig} />}

            {modals.expense && (
                <ExpenseModal
                    onClose={() => toggleModal('expense', false)}
                    onSave={handleSaveExpense}
                />
            )}

            {modals.product && (
                <ProductModal
                    onClose={() => toggleModal('product', false)}
                    onSave={handleSaveProductWrapper}
                    onDelete={(id) => requestConfirm("Borrar", "¿Seguro?", () => deleteProduct(id), true)}
                    editingProduct={editingProduct}
                    imageMode={imageMode}       setImageMode={setImageMode}
                    previewImage={previewImage} setPreviewImage={setPreviewImage}
                    handleFileChange={handleFileChange}
                    categories={categories}    subcategories={subcategories}
                    onRegisterFaulty={(p) => { setFaultyProduct(p); toggleModal('faulty', true); }}
                />
            )}

            {modals.category && (
                <CategoryModal
                    onClose={() => toggleModal('category', false)}
                    onSave={(e) => { e.preventDefault(); if (e.target.catName.value) { addCategory(e.target.catName.value); toggleModal('category', false); } }}
                    onDelete={(id) => requestConfirm("Borrar", "¿Seguro?", () => deleteCategory(id), true)}
                    categories={categories}       subcategories={subcategories}
                    onSaveSub={addSubCategory}    onDeleteSub={deleteSubCategory}
                    onUpdate={updateCategory}
                />
            )}

            {modals.customer && (
                <CustomerModal
                    onClose={() => toggleModal('customer', false)}
                    onSave={handleSaveCustomer}
                    editingCustomer={editingCustomer}
                />
            )}

            {modals.store && (
                <StoreModal
                    onClose={() => toggleModal('store', false)}
                    storeProfile={storeProfile}
                    imageMode={imageMode}       setImageMode={setImageMode}
                    previewImage={previewImage} setPreviewImage={setPreviewImage}
                    handleFileChange={handleFileChange}
                    onSave={handleSaveStore}
                />
            )}

            {modals.stock && scannedProduct && (
                <AddStockModal
                    onClose={() => { toggleModal('stock', false); setScannedProduct(null); }}
                    onConfirm={handleAddStock}
                    scannedProduct={scannedProduct}
                    quantityInputRef={quantityInputRef}
                />
            )}

            {modals.transaction && editingTransaction && (
                <TransactionModal
                    onClose={() => toggleModal('transaction', false)}
                    onSave={handleSaveTransaction}
                    editingTransaction={editingTransaction}
                />
            )}

            {modals.logout && (
                <LogoutConfirmModal
                    onClose={() => toggleModal('logout', false)}
                    onConfirm={handleConfirmLogout}
                />
            )}

            {modals.invitation && (
                <InvitationModal
                    onClose={() => toggleModal('invitation', false)}
                    onGenerate={generateInvitationCode}
                />
            )}

            {modals.faulty && faultyProduct && (
                <FaultyProductModal
                    product={faultyProduct}
                    onClose={() => toggleModal('faulty', false)}
                    onConfirm={handleConfirmFaulty}
                />
            )}
        </>
    );
}

import { formatExportDate } from '../utils/dateHelpers';

/**
 * Encapsula la generación de PDF (stock negativo) y exportación CSV.
 */
export const useExports = ({ products, categories = [], transactions, expenses, balance, storeProfile, dashboardDateRange, purgeTransactions, showNotification, requestConfirm, setIsProcessing }) => {

    // --- PDF: Lista de faltantes agrupada por categoría ---
    // selectedCategoryIds: string[] — IDs de categorías seleccionadas.
    // Si está vacío se incluyen todas (incluyendo "Sin categoría").
    const generateShoppingListPDF = async (selectedCategoryIds = []) => {
        setIsProcessing(true);
        try {
            // 1. Filtrar productos con stock negativo
            const negative = products.filter(p => p.stock < 0);

            if (negative.length === 0) {
                showNotification('✅ ¡No hay productos con stock negativo!');
                setIsProcessing(false);
                return;
            }

            // 2. Determinar si el usuario quiere filtrar por categoría
            const filterByCategory = selectedCategoryIds.length > 0;

            // 3. Agrupar por categoría
            // Clave: categoryId || '__sin_categoria__'
            const groups = {};

            negative.forEach(p => {
                const catId   = p.categoryId || '__sin_categoria__';
                const catName = categories.find(c => c.id === catId)?.name || 'Sin categoría';

                // Si hay filtro activo y esta categoría no está en la selección, saltar
                if (filterByCategory && catId !== '__sin_categoria__' && !selectedCategoryIds.includes(catId)) return;
                if (filterByCategory && catId === '__sin_categoria__' && !selectedCategoryIds.includes('__sin_categoria__')) return;

                if (!groups[catId]) groups[catId] = { name: catName, products: [] };
                groups[catId].products.push(p);
            });

            // Ordenar productos dentro de cada grupo: más negativo primero
            Object.values(groups).forEach(g => g.products.sort((a, b) => a.stock - b.stock));

            // Ordenar grupos alfabéticamente ("Sin categoría" siempre al final)
            const sortedGroups = Object.values(groups).sort((a, b) => {
                if (a.name === 'Sin categoría') return 1;
                if (b.name === 'Sin categoría') return -1;
                return a.name.localeCompare(b.name, 'es');
            });

            if (sortedGroups.length === 0) {
                showNotification('✅ No hay faltantes en las categorías seleccionadas.');
                setIsProcessing(false);
                return;
            }

            const totalProducts = sortedGroups.reduce((acc, g) => acc + g.products.length, 0);
            const filterLabel   = filterByCategory
                ? sortedGroups.map(g => g.name).join(', ')
                : 'Todas las categorías';

            // 4. Generar HTML del PDF
            const html2pdf = (await import('html2pdf.js')).default;

            const groupsHTML = sortedGroups.map(group => `
                <div style="margin-bottom: 32px; break-inside: avoid;">
                    <!-- Encabezado de categoría -->
                    <div style="background: linear-gradient(135deg, #1e40af, #1d4ed8); padding: 10px 16px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
                        <span style="font-size: 13px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                            📦 ${group.name}
                        </span>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.7); margin-left: 8px;">
                            (${group.products.length} producto${group.products.length !== 1 ? 's' : ''})
                        </span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #dbeafe; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
                        <thead>
                            <tr style="background: #eff6ff;">
                                <th style="text-align: left; padding: 9px 12px; color: #1e40af; font-size: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #bfdbfe;">Producto / Código</th>
                                <th style="text-align: center; padding: 9px 12px; color: #1e40af; font-size: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #bfdbfe;">Stock actual</th>
                                <th style="text-align: right; padding: 9px 12px; color: #1e40af; font-size: 10px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #bfdbfe;">A comprar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.products.map((p, i) => `
                                <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8faff'};">
                                    <td style="padding: 11px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
                                        <span style="font-weight: bold; display: block; color: #1e293b;">${p.name}</span>
                                        <span style="font-size: 10px; color: #94a3b8;">${p.barcode || 'Sin código'}</span>
                                    </td>
                                    <td style="padding: 11px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: center;">
                                        <span style="font-weight: bold; color: #ef4444;">${p.stock}</span>
                                    </td>
                                    <td style="padding: 11px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right;">
                                        <span style="font-weight: bold; color: #2563eb;">+${Math.abs(p.stock)}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('');

            const content = `
                <div style="font-family: Helvetica, Arial, sans-serif; padding: 36px; color: #333; background: white;">

                    <!-- CABECERA -->
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 28px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px;">
                        <div>
                            ${storeProfile.logoUrl
                                ? `<img src="${storeProfile.logoUrl}" crossorigin="anonymous"
                                        style="height: 56px; width: auto; object-fit: contain; margin-bottom: 8px;"
                                        onerror="this.style.display='none';" />`
                                : ''}
                            <h1 style="font-size: 22px; font-weight: bold; color: #1e40af; margin: 0;">${storeProfile.name}</h1>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="font-size: 20px; font-weight: 800; color: #ef4444; margin: 0; text-transform: uppercase; letter-spacing: 1.5px;">Lista de Faltantes</h2>
                            <div style="font-size: 11px; color: #64748b; margin-top: 6px; line-height: 1.6;">
                                Fecha: ${new Date().toLocaleDateString('es-AR')}<br/>
                                Hora: ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <!-- RESUMEN -->
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 12px; color: #9a3412; line-height: 1.6;">
                            <strong>Filtro:</strong> ${filterLabel}<br/>
                            <strong>Total de productos a reponer:</strong> ${totalProducts}
                        </div>
                        <div style="font-size: 11px; color: #c2410c; text-align: right;">
                            Stock negativo = unidades<br/>comprometidas sin stock físico
                        </div>
                    </div>

                    <!-- GRUPOS POR CATEGORÍA -->
                    ${groupsHTML}

                    <!-- PIE -->
                    <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                        Generado automáticamente por ${storeProfile.name} • ${new Date().toLocaleString('es-AR')}
                    </div>
                </div>`;

            const el = document.createElement('div');
            el.innerHTML = content;

            const catSlug = filterByCategory
                ? sortedGroups.map(g => g.name).join('-').replace(/[^a-z0-9]/gi, '_').slice(0, 40)
                : 'Todas';

            await html2pdf().set({
                margin: 0,
                filename: `Faltantes_${catSlug}_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            }).from(el).save();

            showNotification('✅ Lista de faltantes generada');
        } catch (e) {
            console.error('[useExports] Error al generar PDF de faltantes', { error: e.message });
            showNotification('❌ Error generando PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- CSV: Exportar reporte completo ---
    const handleExportData = () => {
        if (transactions.length === 0) {
            showNotification("⚠️ No hay datos para exportar.");
            return;
        }
        try {
            let csv = "\uFEFF"; // BOM para Excel
            csv += `REPORTE GENERAL (${dashboardDateRange === 'week' ? 'Últimos 7 días' : 'Últimos 30 días'})\n`;
            csv += "INVENTARIO ACTUAL DE PRODUCTOS\n";
            csv += "Nombre,Código,Precio,Costo,Stock,Categoría\n";
            products.forEach(p => {
                csv += `"${p.name}","${p.barcode || ''}",${p.price},${p.cost || 0},${p.stock},"${p.categoryId || ''}"\n`;
            });
            csv += `\nGenerado el,${new Date().toLocaleString()}\n\n`;
            csv += "METRICAS DEL PERIODO\n";
            csv += `Ventas Totales,$${balance.periodSales}\n`;
            csv += `Gastos Operativos,-$${balance.periodExpenses}\n`;
            csv += `Costo Mercadería,-$${balance.periodCost}\n`;
            csv += `GANANCIA NETA,$${balance.periodNet}\n\n`;
            csv += "VENTAS POR CATEGORIA\n";
            csv += "Categoría,Monto Vendido\n";
            balance.salesByCategory.forEach(cat => { csv += `${cat.name},$${cat.value}\n`; });
            csv += "\nGASTOS DETALLADOS\n";
            csv += "Fecha,Descripción,Monto\n";
            expenses.forEach(e => {
                csv += `${formatExportDate(e.date)},${e.description},${e.amount}\n`;
            });
            csv += "\nDETALLE DE TRANSACCIONES\n";
            csv += "Fecha,Cliente,Estado,Método,Total,Pagado,Items\n";
            transactions.forEach(t => {
                const date = formatExportDate(t.date);
                const itemsStr = t.items?.map(i => `${i.qty}x ${i.name}`).join(' | ') || '';
                csv += `${date},${t.clientName},${t.paymentStatus},${t.paymentMethod},${t.total},${t.amountPaid || 0},"${itemsStr.replace(/"/g, '""')}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Reporte_Completo_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setTimeout(() => {
                requestConfirm(
                    "¿Limpiar Base de Datos?",
                    "✅ Reporte descargado.\n\n⚠️ ADVERTENCIA: esta operación solo restaura el stock de las ventas de los últimos 35 días (las que están cargadas en memoria). Ventas más antiguas en Firestore NO tendrán su stock restaurado.\n\n¿Querés borrar el historial de ventas y gastos para liberar espacio?\nEsto NO borra productos ni clientes.",
                    async () => {
                        setIsProcessing(true);
                        try {
                            await purgeTransactions();
                            showNotification("🧹 Historial limpiado");
                        } catch (e) {
                            console.error("[purge] Error al limpiar historial:", e);
                            showNotification("❌ Error al limpiar el historial. Intentá de nuevo.");
                        } finally {
                            setIsProcessing(false);
                        }
                    },
                    true
                );
            }, 1500);
        } catch (error) {
            console.error("Error exportando:", error);
            showNotification("❌ Error al generar el reporte.");
        }
    };

    return { generateShoppingListPDF, handleExportData };
};

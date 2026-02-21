/**
 * Encapsula la generación de PDF (stock negativo) y exportación CSV.
 * Extrae esta responsabilidad de App.jsx.
 */
export const useExports = ({ products, transactions, expenses, balance, storeProfile, dashboardDateRange, purgeTransactions, showNotification, requestConfirm, setIsProcessing }) => {

    // --- PDF: Lista de faltantes (stock negativo) ---
    const handlePrintShoppingList = async () => {
        setIsProcessing(true);
        try {
            const negativeStockProducts = products
                .filter(p => p.stock < 0)
                .sort((a, b) => a.stock - b.stock);

            if (negativeStockProducts.length === 0) {
                showNotification("✅ ¡No hay productos con stock negativo!");
                setIsProcessing(false);
                return;
            }

            const html2pdf = (await import('html2pdf.js')).default;

            const content = `
                <div style="font-family: Helvetica, Arial, sans-serif; padding: 40px; color: #333; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px;">
                        <div>
                            ${storeProfile.logoUrl
                                ? `<img src="${storeProfile.logoUrl}"
                                        crossorigin="anonymous"
                                        style="height: 60px; width: auto; object-fit: contain; margin-bottom: 10px;"
                                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                   <div style="display:none; height:60px; width:60px; background:#eff6ff; border-radius:8px; align-items:center; justify-content:center; margin-bottom:10px; font-size:24px;">🏪</div>`
                                : ''}
                            <h1 style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 0;">${storeProfile.name}</h1>
                        </div>
                        <div style="text-align: right;">
                            <h2 style="font-size: 24px; font-weight: 200; color: #ef4444; margin: 0; text-transform: uppercase; letter-spacing: 2px;">STOCK NEGATIVO</h2>
                            <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                                FECHA: ${new Date().toLocaleDateString()}<br/>
                                HORA: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="background: #fff1f2; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #fecdd3; color: #9f1239; font-size: 13px;">
                        <strong>INFORME DE RECUPERACIÓN:</strong> Productos vendidos sin stock disponible.
                        La columna "A COMPRAR" indica la cantidad para volver el stock a 0.
                    </div>

                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 12px 10px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">PRODUCTO / CÓDIGO</th>
                                <th style="text-align: center; padding: 12px 10px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">STOCK ACTUAL</th>
                                <th style="text-align: right; padding: 12px 10px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">A COMPRAR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${negativeStockProducts.map(p => `
                                <tr>
                                    <td style="padding: 14px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                                        <span style="font-weight: bold; display: block;">${p.name}</span>
                                        <span style="font-size: 11px; color: #94a3b8;">${p.barcode || 'Sin código'}</span>
                                    </td>
                                    <td style="padding: 14px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: center;">
                                        <span style="font-weight: bold; color: #ef4444;">${p.stock}</span>
                                    </td>
                                    <td style="padding: 14px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: right;">
                                        <span style="font-weight: bold; font-size: 14px; color: #2563eb;">+${Math.abs(p.stock)}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        Generado automáticamente por el sistema de gestión • ${storeProfile.name}
                    </div>
                </div>`;

            const el = document.createElement('div');
            el.innerHTML = content;

            await html2pdf().set({
                margin: 0,
                filename: `Recuperacion_Stock_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(el).save();

            showNotification("✅ Lista de faltantes generada");
        } catch (e) {
            console.error(e);
            showNotification("❌ Error generando PDF");
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
                csv += `${new Date(e.date?.seconds * 1000).toLocaleDateString()},${e.description},${e.amount}\n`;
            });
            csv += "\nDETALLE DE TRANSACCIONES\n";
            csv += "Fecha,Cliente,Estado,Método,Total,Pagado,Items\n";
            transactions.forEach(t => {
                const date = new Date(t.date?.seconds * 1000).toLocaleString();
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
                    "✅ Reporte descargado.\n\n¿Querés borrar el historial de ventas y gastos para liberar espacio?\nEsto NO borra productos ni clientes.",
                    async () => {
                        setIsProcessing(true);
                        await purgeTransactions();
                        setIsProcessing(false);
                        showNotification("🧹 Historial limpiado");
                    },
                    true
                );
            }, 1500);
        } catch (error) {
            console.error("Error exportando:", error);
            showNotification("❌ Error al generar el reporte.");
        }
    };

    return { handlePrintShoppingList, handleExportData };
};

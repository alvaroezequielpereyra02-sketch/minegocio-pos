import { useState, useEffect, useMemo } from 'react';
import {
    collection, query, orderBy, where, onSnapshot,
    addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { getDb, appId } from '../config/firebase';

/**
 * useOffers
 *
 * Estructura de un documento en stores/{appId}/offers/{id}:
 *   title         string
 *   description   string
 *   discount      string       — etiqueta visual: "20% OFF", "2x1", etc.
 *   discountType  'percent' | 'fixed'
 *   discountValue number       — 20 para 20%, o 500 para $500 fijo
 *   productIds    string[]     — IDs de los productos incluidos en la oferta
 *   validUntil    string       — fecha ISO "2025-12-31"
 *   imageUrl      string
 *   active        boolean
 *   notified      boolean
 *   createdAt     Timestamp
 *
 * activeOfferMap: Map<productId, { discountType, discountValue, offerId, offerTitle }>
 *   Permite O(1) lookup en useCart para aplicar descuentos al agregar productos.
 *   Solo incluye ofertas activas y no vencidas.
 *   Si un producto tiene múltiples ofertas activas, gana la de mayor descuento.
 */
export const useOffers = (userRole = 'client') => {
    const [offers, setOffers]   = useState([]);
    const [sending, setSending] = useState(null);

    useEffect(() => {
        let unsub = () => {};
        getDb().then(db => {
            // Admins ven todas las ofertas (activas e inactivas) para poder editarlas.
            // Clientes solo leen las activas — coincide con la regla de Firestore
            // que filtra por resource.data.active == true para no-admins.
            // Sin el where() en la query, Firestore deniega la query completa.
            const offersQuery = userRole === 'admin'
                ? query(collection(db, 'stores', appId, 'offers'), orderBy('createdAt', 'desc'))
                : query(collection(db, 'stores', appId, 'offers'), where('active', '==', true), orderBy('createdAt', 'desc'));
            unsub = onSnapshot(offersQuery,
                (snap) => setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            );
        });
        return () => unsub();
    }, []);

    // Mapa indexado por productId — se recalcula solo cuando cambia offers
    const activeOfferMap = useMemo(() => {
        const map   = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        offers.forEach(offer => {
            if (!offer.active) return;
            if (offer.validUntil && new Date(offer.validUntil + 'T23:59:59') < today) return;
            if (!offer.productIds?.length) return;

            offer.productIds.forEach(pid => {
                const candidate = {
                    discountType:  offer.discountType  ?? 'percent',
                    discountValue: Number(offer.discountValue ?? 0),
                    offerId:       offer.id,
                    offerTitle:    offer.discount || offer.title,
                };
                const existing = map.get(pid);
                // Si ya hay una oferta para este producto, conservar la de mayor valor
                if (!existing || candidate.discountValue > existing.discountValue) {
                    map.set(pid, candidate);
                }
            });
        });
        return map;
    }, [offers]);

    const addOffer = async (data) => {
        const db = await getDb();
        return addDoc(collection(db, 'stores', appId, 'offers'), {
            ...data,
            productIds: data.productIds ?? [],
            active:     false,
            notified:   false,
            createdAt:  serverTimestamp(),
        });
    };

    const updateOffer = async (id, data) => {
        const db = await getDb();
        return updateDoc(doc(db, 'stores', appId, 'offers', id), data);
    };

    const deleteOffer = async (id) => {
        const db = await getDb();
        return deleteDoc(doc(db, 'stores', appId, 'offers', id));
    };

    const publishOffer = async (offer) => {
        setSending(offer.id);
        try {
            const res = await fetch('/api/notify-users', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    storeId:     appId,
                    offerId:     offer.id,
                    title:       offer.title,
                    description: offer.description || '',
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
            await updateOffer(offer.id, { active: true, notified: true });
            return { ok: true, sent: json.sent };
        } catch (err) {
            return { ok: false, error: err.message };
        } finally {
            setSending(null);
        }
    };

    return { offers, sending, activeOfferMap, addOffer, updateOffer, deleteOffer, publishOffer };
};

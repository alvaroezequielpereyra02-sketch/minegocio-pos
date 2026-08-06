/**
 * src/hooks/useAuth.js
 *
 * Reemplaza Firebase Auth por Google OAuth + JWT propio.
 *
 * Cambios de forma respecto a la versión anterior (para quien compare):
 * - login(email, password)      → loginWithGoogle(credential)
 * - register({...})             → registerWithInvite({ credential, inviteCode })
 * - resetPassword(email)        → ya no existe (no hay contraseñas que resetear)
 * - user / userData             → se mantienen con la misma forma general para
 *                                   no romper el resto de la app de una sola vez
 *                                   (migración incremental).
 */
import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.js';
import { tokenStorage } from '../services/api.js';

function mapUserData(me) {
  if (!me) return null;
  return {
    id:              me.id,
    role:            me.role,
    name:            me.name,
    email:           me.email,
    phone:           me.phone,
    address:         me.address,
    businessName:    me.businessName,
    avatarUrl:       me.avatarUrl,
    profileComplete: me.profileComplete,
    commissionRate:  me.commissionRate,
  };
}

export const useAuth = () => {
  const [user, setUser]               = useState(null);
  const [userData, setUserData]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError]   = useState('');

  // Trae el perfil fresco del servidor y actualiza el estado local.
  // Se usa al montar la app y al volver a la pestaña.
  const hydrate = useCallback(async () => {
    if (!tokenStorage.get()) {
      setAuthLoading(false);
      return;
    }
    try {
      const me = await authService.getMe();
      setUser({ uid: me.id, email: me.email, name: me.name, avatarUrl: me.avatarUrl });
      setUserData(mapUserData(me));
    } catch {
      // Token inválido, expirado, o cuenta desactivada → limpiar sesión local.
      tokenStorage.clear();
      setUser(null);
      setUserData(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Si api.js detecta un 401 en cualquier llamada, avisa acá para limpiar la sesión.
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setUserData(null);
    };
    window.addEventListener('mnpos:session-expired', handleExpired);
    return () => window.removeEventListener('mnpos:session-expired', handleExpired);
  }, []);

  // Al volver a la pestaña, re-sincroniza el perfil — reemplaza el patrón de
  // refresco de custom claims que existía con Firebase.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tokenStorage.get()) hydrate();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [hydrate]);

  /**
   * Login / registro automático de cliente. `credential` es el id_token que
   * devuelve el botón de Google (response.credential).
   */
  const loginWithGoogle = async (credential) => {
    try {
      setLoginError('');
      const me = await authService.loginWithGoogle(credential);
      setUser({ uid: me.id, email: me.email, name: me.name, avatarUrl: me.avatarUrl });
      setUserData(mapUserData(me));
      return me;
    } catch (err) {
      setLoginError(err.message || 'No se pudo iniciar sesión con Google.');
      throw err;
    }
  };

  /**
   * Registro (o ascenso) de empleado/admin con código de invitación.
   */
  const registerWithInvite = async ({ credential, inviteCode }) => {
    try {
      setLoginError('');
      const me = await authService.registerWithInvite({ googleIdToken: credential, inviteCode });
      setUser({ uid: me.id, email: me.email, name: me.name, avatarUrl: me.avatarUrl });
      setUserData(mapUserData(me));
      return me;
    } catch (err) {
      setLoginError(err.message || 'No se pudo completar el registro.');
      throw err;
    }
  };

  /**
   * Completa el perfil obligatorio del cliente (nombre, negocio, dirección,
   * teléfono). Al terminar, profileComplete pasa a true y destraba el checkout.
   */
  const completeProfile = async (profile) => {
    const updated = await authService.completeProfile(profile);
    setUserData(mapUserData(updated));
    return updated;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setUserData(null);
  };

  return {
    user, userData, authLoading,
    loginError, setLoginError,
    loginWithGoogle, registerWithInvite, completeProfile, logout,
  };
};

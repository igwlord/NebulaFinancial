/**
 * 🔐 NEBULA FINANCIAL - AUTHENTICATION MODULE
 * ===========================================
 * Sistema completo de autenticación con Firebase
 */

export class NebulaAuth {
    constructor() {
        this.user = null;
        this.isInitialized = false;
        this.authStateListeners = [];
        
        // Inicializar Firebase cuando esté listo
        this.initializeFirebase();
    }
      /**
     * 🔥 Inicializar Firebase
     */
    async initializeFirebase() {
        try {
            // Verificar que Firebase esté cargado
            if (typeof firebase === 'undefined') {
                console.warn('⚠️ Firebase SDK no está cargado, modo offline activado');
                this.isInitialized = true;
                return;
            }
            
            // Verificar configuración
            if (!window.NebulaConfig || !window.NebulaConfig.firebase) {
                console.warn('⚠️ Configuración de Firebase no encontrada, modo offline activado');
                this.isInitialized = true;
                return;
            }
            
            // Inicializar Firebase con configuración
            if (!firebase.apps.length) {
                firebase.initializeApp(window.NebulaConfig.firebase);
                console.log('🔥 Firebase inicializado correctamente');
            }
            
            // Configurar persistencia de autenticación
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            
            // Escuchar cambios de estado de autenticación
            firebase.auth().onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });
            
            // Configurar proveedores
            this.setupAuthProviders();
            
            this.isInitialized = true;
            console.log('✅ Firebase Auth inicializado correctamente');
            
        } catch (error) {
            console.error('❌ Error inicializando Firebase, activando modo offline:', error);
            this.isInitialized = true; // Permitir modo offline
        }
    }
    
    /**
     * 🔧 Configurar proveedores de autenticación
     */
    setupAuthProviders() {
        // Proveedor de Google
        this.googleProvider = new firebase.auth.GoogleAuthProvider();
        this.googleProvider.addScope('email');
        this.googleProvider.addScope('profile');
        
        // Configuración adicional del proveedor
        this.googleProvider.setCustomParameters({
            prompt: 'select_account'
        });
    }
    
    /**
     * 🚪 Iniciar sesión con Google
     */    async signInWithGoogle() {
        try {
            if (!this.isInitialized) {
                throw new Error('Sistema de autenticación no inicializado');
            }
            
            // Verificar que Firebase esté disponible y configurado
            if (typeof firebase === 'undefined' || !firebase.apps.length) {
                throw new Error('Firebase no está disponible. Usa el modo invitado para acceder sin conexión.');
            }
              console.log('🔄 Iniciando sesión con Google...');
            
            // Usar popup para mejor UX
            const result = await firebase.auth().signInWithPopup(this.googleProvider);
            const user = result.user;
            
            // Obtener token de acceso si es necesario (puede ser null)
            const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
            const token = credential ? credential.accessToken : null;
            
            console.log('✅ Sesión iniciada exitosamente:', user.displayName);
            console.log('🔑 Token obtenido:', token ? 'Sí' : 'No disponible');
            
            // Crear o actualizar perfil de usuario
            await this.createUserProfile(user);
            
            return {
                success: true,
                user: this.formatUser(user),
                token: token
            };
            
        } catch (error) {
            console.error('❌ Error en inicio de sesión:', error);
            return this.handleAuthError(error);
        }
    }
    
    /**
     * 👤 Crear/actualizar perfil de usuario en Firestore
     */
    async createUserProfile(user) {
        try {
            const userRef = firebase.firestore()
                .collection(window.NebulaConfig.firestore.collections.users)
                .doc(user.uid);
            
            const userDoc = await userRef.get();
            
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (!userDoc.exists) {
                // Usuario nuevo - crear perfil completo
                userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                userData.settings = {
                    theme: 'aureoAmanecer',
                    privacy: true,
                    notifications: true,
                    currency: 'CLP'
                };
                
                console.log('👤 Creando nuevo perfil de usuario');
            } else {
                console.log('🔄 Actualizando perfil existente');
            }
            
            await userRef.set(userData, { merge: true });
            
        } catch (error) {
            console.error('❌ Error creando perfil:', error);
        }
    }
    
    /**
     * 🔄 Manejar cambios de estado de autenticación
     */
    handleAuthStateChange(user) {
        this.user = user;
        
        // Notificar a todos los listeners
        this.authStateListeners.forEach(callback => {
            callback(user ? this.formatUser(user) : null);
        });
        
        // Actualizar UI global
        if (window.appState) {
            window.appState.user = user ? this.formatUser(user) : null;
            if (window.renderApp) {
                window.renderApp();
            }
        }
    }
    
    /**
     * 🚪 Cerrar sesión
     */
    async signOut() {
        try {
            await firebase.auth().signOut();
            console.log('✅ Sesión cerrada correctamente');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error cerrando sesión:', error);
            return this.handleAuthError(error);
        }
    }    /**
     * 👥 Iniciar sesión como invitado (MODO OFFLINE PURO)
     */
    async signInAsGuest() {
        try {
            console.log('👥 Iniciando modo invitado offline (sin Firebase)');
            
            // Crear usuario invitado local directamente
            const guestUser = {
                uid: 'guest_' + Date.now(),
                email: null,
                displayName: 'Invitado',
                photoURL: null,
                isAnonymous: true,
                createdAt: new Date().toISOString(),
                mode: 'offline'
            };
            
            // Guardar en localStorage para persistencia
            localStorage.setItem('nebula_guest_user', JSON.stringify(guestUser));
            
            console.log('✅ Usuario invitado creado exitosamente:', guestUser);
            
            return {
                success: true,
                user: guestUser,
                isGuest: true,
                offline: true
            };
            
        } catch (error) {
            console.error('❌ Error creando usuario invitado:', error);
            
            // Fallback ultra-seguro
            const fallbackUser = {
                uid: 'guest_fallback_' + Date.now(),
                email: null,
                displayName: 'Invitado',
                photoURL: null,
                isAnonymous: true,
                createdAt: new Date().toISOString(),
                mode: 'fallback'
            };
            
            try {
                localStorage.setItem('nebula_guest_user', JSON.stringify(fallbackUser));
            } catch (storageError) {
                console.warn('⚠️ No se pudo guardar en localStorage:', storageError);
            }
            
            return {
                success: true,
                user: fallbackUser,
                isGuest: true,
                offline: true,
                fallback: true
            };
        }
    }
    
    /**
     * 📝 Formatear datos de usuario
     */
    formatUser(user) {
        return {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Usuario',
            photoURL: user.photoURL,
            isAnonymous: user.isAnonymous,
            emailVerified: user.emailVerified,
            createdAt: user.metadata.creationTime,
            lastLogin: user.metadata.lastSignInTime
        };
    }
    
    /**
     * 👂 Agregar listener para cambios de autenticación
     */
    onAuthStateChanged(callback) {
        this.authStateListeners.push(callback);
        
        // Si ya hay un usuario, notificar inmediatamente
        if (this.user) {
            callback(this.formatUser(this.user));
        }
        
        // Retornar función para remover listener
        return () => {
            const index = this.authStateListeners.indexOf(callback);
            if (index > -1) {
                this.authStateListeners.splice(index, 1);
            }
        };
    }
    
    /**
     * 🛠️ Obtener usuario actual
     */
    getCurrentUser() {
        return this.user ? this.formatUser(this.user) : null;
    }
      /**
     * ❌ Manejar errores de autenticación
     */
    handleAuthError(error) {
        let message = 'Error desconocido';
        let helpText = '';
        
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                message = 'Inicio de sesión cancelado';
                helpText = 'Puedes intentar nuevamente o usar el modo invitado';
                break;
            case 'auth/popup-blocked':
                message = 'Popup bloqueado por el navegador';
                helpText = 'Permite popups para este sitio o usa el modo invitado';
                break;
            case 'auth/network-request-failed':
                message = 'Error de conexión a internet';
                helpText = 'Verifica tu conexión o usa el modo invitado para acceso offline';
                break;
            case 'auth/too-many-requests':
                message = 'Demasiados intentos de login';
                helpText = 'Espera un momento antes de intentar nuevamente';
                break;
            case 'auth/unauthorized-domain':
                message = 'Dominio no autorizado para OAuth';
                helpText = 'El administrador debe añadir este dominio a Firebase Console. Mientras tanto, usa el modo invitado';
                break;
            case 'auth/admin-restricted-operation':
                message = 'Operación restringida por el administrador';
                helpText = 'La autenticación anónima debe ser habilitada en Firebase Console. Usa el modo invitado mientras tanto';
                break;
            case 'auth/operation-not-allowed':
                message = 'Método de autenticación no habilitado';
                helpText = 'El administrador debe habilitar Google Auth en Firebase Console. Usa el modo invitado';
                break;
            default:
                message = error.message || 'Error de autenticación';
                helpText = 'Intenta con el modo invitado para acceder sin autenticación';
        }
        
        console.error('🔥 Error de autenticación:', message);
        if (helpText) {
            console.log('💡 Sugerencia:', helpText);
        }
        
        return {
            success: false,
            error: error.code,
            message: message,
            helpText: helpText
        };
    }
}

// Crear y exportar instancia
export const authService = new NebulaAuth();

// También mantener compatibilidad global
window.NebulaAuth = authService;

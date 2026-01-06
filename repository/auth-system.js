// 📁 auth-system.js - Sistema de Autenticación y Limitación para AndreaAI (CORREGIDO)

'use strict';

/**
 * 🔐 CONFIGURACIÓN FIREBASE - REEMPLAZA CON TUS CREDENCIALES
 * 1. Ve a https://console.firebase.google.com/
 * 2. Crea un proyecto (o usa uno existente)
 * 3. En Authentication → Sign-in method → habilita Email/Password
 * 4. En Firestore Database → crea base de datos en modo de prueba
 * 5. Ve a Configuración del proyecto → Tus apps → Añadir app (Web)
 * 6. Copia la configuración aquí
 */

const FIREBASE_CONFIG = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID"
};

// 🔧 CLASE DE AUTENTICACIÓN MEJORADA
class AuthSystem {
    constructor() {
        this.user = null;
        this.conversationCount = 0;
        this.maxFreeConversations = 3;
        this.isPremium = false;
        this.authInitialized = false;
        
        this.init();
    }

    // 🔥 Inicializar Firebase
    init() {
        // Verificar si Firebase está disponible
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase no está cargado. Verifica que los scripts se carguen correctamente.');
            this.showNotification('Error: Firebase no está disponible', 'error');
            return;
        }
        
        try {
            // Inicializar Firebase si no está inicializado
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            this.authInitialized = true;
            
            console.log('🔥 Firebase inicializado correctamente');
            
            // Configurar observador de estado de autenticación
            this.checkAuthState();
            
            // Inicializar UI
            setTimeout(() => this.initUI(), 500);
            
        } catch (error) {
            console.error('Error al inicializar Firebase:', error);
            this.showNotification('Error de configuración de Firebase', 'error');
        }
    }

    // 👁️ Verificar estado de autenticación
    checkAuthState() {
        if (!this.authInitialized) return;
        
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.user = user;
                await this.loadUserData();
                this.showPremiumFeatures();
                this.updateUI();
                console.log('✅ Usuario autenticado:', user.email);
                
                this.showNotification(`¡Bienvenido ${user.email}!`, 'success');
            } else {
                this.user = null;
                this.loadLocalConversationCount();
                this.hidePremiumFeatures();
                this.updateUI();
                console.log('👤 Usuario no autenticado');
            }
        });
    }

    // 📝 Cargar datos del usuario
    async loadUserData() {
        if (!this.authInitialized || !this.user) return;
        
        try {
            const userDoc = await this.db.collection('users').doc(this.user.uid).get();
            
            if (userDoc.exists) {
                const data = userDoc.data();
                this.conversationCount = data.conversationCount || 0;
                this.isPremium = data.premium || false;
                console.log('📊 Datos del usuario cargados:', data);
            } else {
                // Crear documento si no existe
                await this.db.collection('users').doc(this.user.uid).set({
                    email: this.user.email,
                    conversationCount: 0,
                    premium: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    level: 'registered'
                });
            }
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            this.loadLocalConversationCount();
        }
    }

    // 💾 Cargar contador local para invitados
    loadLocalConversationCount() {
        try {
            const savedCount = localStorage.getItem('andrea_guest_conversations');
            this.conversationCount = savedCount ? parseInt(savedCount) : 0;
            console.log('📱 Conversaciones locales:', this.conversationCount);
        } catch (error) {
            console.error('Error al cargar contador local:', error);
            this.conversationCount = 0;
        }
    }

    // ✍️ Registrar usuario
    async register(email, password) {
        if (!this.authInitialized) {
            return { success: false, error: 'Firebase no está inicializado' };
        }
        
        try {
            // Validaciones
            if (!this.validateEmail(email)) {
                this.showNotification('Correo electrónico inválido', 'error');
                return { success: false, error: 'Correo inválido' };
            }
            
            if (password.length < 6) {
                this.showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
                return { success: false, error: 'Contraseña muy corta' };
            }
            
            // Crear usuario en Firebase Auth
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Crear documento en Firestore
            await this.db.collection('users').doc(user.uid).set({
                email: email,
                conversationCount: 0,
                premium: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                level: 'registered'
            });
            
            // Migrar conversaciones locales si existen
            const localCount = localStorage.getItem('andrea_guest_conversations');
            if (localCount) {
                await this.db.collection('users').doc(user.uid).update({
                    conversationCount: firebase.firestore.FieldValue.increment(parseInt(localCount))
                });
                localStorage.removeItem('andrea_guest_conversations');
            }
            
            this.showNotification('¡Cuenta creada exitosamente!', 'success');
            return { success: true, user: user };
            
        } catch (error) {
            console.error('Error en registro:', error);
            const errorMessage = this.getErrorMessage(error.code);
            this.showNotification(errorMessage, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // 🔑 Iniciar sesión
    async login(email, password) {
        if (!this.authInitialized) {
            return { success: false, error: 'Firebase no está inicializado' };
        }
        
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Actualizar último inicio de sesión
            await this.db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.showNotification('¡Inicio de sesión exitoso!', 'success');
            return { success: true, user: user };
            
        } catch (error) {
            console.error('Error en login:', error);
            const errorMessage = this.getErrorMessage(error.code);
            this.showNotification(errorMessage, 'error');
            return { success: false, error: errorMessage };
        }
    }

    // 🚪 Cerrar sesión
    async logout() {
        if (!this.authInitialized) return;
        
        try {
            await this.auth.signOut();
            this.showNotification('Sesión cerrada', 'info');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            this.showNotification('Error al cerrar sesión', 'error');
        }
    }

    // ➕ Incrementar contador de conversaciones
    async incrementConversationCount() {
        this.conversationCount++;
        
        if (this.user && this.authInitialized) {
            // Usuario registrado: guardar en Firestore
            try {
                await this.db.collection('users').doc(this.user.uid).update({
                    conversationCount: firebase.firestore.FieldValue.increment(1),
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Error al actualizar contador en Firestore:', error);
                // Guardar localmente como respaldo
                localStorage.setItem('andrea_backup_count', this.conversationCount);
            }
        } else {
            // Usuario invitado: guardar en localStorage
            localStorage.setItem('andrea_guest_conversations', this.conversationCount);
            
            // Verificar límite
            if (this.conversationCount >= this.maxFreeConversations) {
                this.showLimitReachedModal();
            }
        }
        
        this.updateUI();
    }

    // ✅ Verificar si puede chatear
    canChat() {
        if (this.user || this.isPremium) {
            return true; // Usuarios registrados o premium tienen acceso ilimitado
        }
        
        return this.conversationCount < this.maxFreeConversations;
    }

    // 📊 Actualizar interfaz
    updateUI() {
        const authBtn = document.getElementById('auth-button');
        const userInfo = document.getElementById('user-info');
        const conversationCounter = document.getElementById('conversation-counter');
        const chatInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');

        if (this.user) {
            // Usuario autenticado
            if (authBtn) {
                authBtn.innerHTML = `<i class="fas fa-user-check"></i> ${this.truncateEmail(this.user.email)}`;
                authBtn.title = 'Cerrar sesión';
                authBtn.onclick = () => this.logout();
            }
            
            if (userInfo) {
                userInfo.innerHTML = `
                    <div class="user-status">
                        <i class="fas fa-circle ${this.isPremium ? 'premium' : 'free'}"></i>
                        <span>${this.isPremium ? 'Premium' : 'Gratis'}</span>
                    </div>
                `;
            }

            if (conversationCounter) {
                conversationCounter.innerHTML = `
                    <i class="fas fa-infinity"></i> Acceso ilimitado
                `;
            }

            // Habilitar chat
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = 'Escribe un mensaje o comando...';
            }
            if (sendBtn) sendBtn.disabled = false;
            
        } else {
            // Usuario invitado
            if (authBtn) {
                authBtn.innerHTML = '<i class="fas fa-user"></i> Iniciar sesión';
                authBtn.title = 'Iniciar sesión o Registrarse';
                authBtn.onclick = () => this.showAuthModal();
            }
            
            if (userInfo) {
                userInfo.innerHTML = '<i class="fas fa-user-clock"></i> Invitado';
            }

            if (conversationCounter) {
                const remaining = this.maxFreeConversations - this.conversationCount;
                const color = remaining > 1 ? '#4CAF50' : (remaining === 1 ? '#FF9800' : '#F44336');
                conversationCounter.innerHTML = `
                    <i class="fas fa-comment" style="color: ${color}"></i> 
                    <span style="color: ${color}">${remaining} conversaciones restantes</span>
                `;
            }

            // Deshabilitar chat si alcanzó el límite
            const canChat = this.canChat();
            if (chatInput) {
                chatInput.disabled = !canChat;
                chatInput.placeholder = canChat 
                    ? 'Escribe un mensaje o comando...' 
                    : 'Regístrate para continuar chateando';
            }
            if (sendBtn) sendBtn.disabled = !canChat;
        }
    }

    // 🪟 Inicializar elementos UI
    initUI() {
        // Verificar si ya existe la sección de autenticación
        if (document.getElementById('auth-button')) return;
        
        // Crear botón de autenticación en sidebar
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        
        const authSection = document.createElement('div');
        authSection.className = 'auth-section';
        authSection.innerHTML = `
            <div class="auth-header">
                <button id="auth-button" class="btn-auth">
                    <i class="fas fa-user"></i> Iniciar sesión
                </button>
                <div id="user-info" class="user-info"></div>
            </div>
            <div id="conversation-counter" class="conversation-counter"></div>
            <div id="premium-features" class="premium-features" style="display: none;">
                <h4><i class="fas fa-crown"></i> Funciones Premium</h4>
                <div class="premium-list"></div>
            </div>
        `;
        
        // Insertar después del botón de nuevo chat
        const newChatBtn = document.querySelector('.btn-new-chat');
        if (newChatBtn) {
            sidebar.insertBefore(authSection, newChatBtn.nextSibling);
        } else {
            sidebar.appendChild(authSection);
        }
        
        this.updateUI();
    }

    // 🔔 Mostrar notificación
    showNotification(message, type = 'info') {
        // Crear área de notificaciones si no existe
        let notificationArea = document.getElementById('notification-area');
        if (!notificationArea) {
            notificationArea = document.createElement('div');
            notificationArea.id = 'notification-area';
            document.body.appendChild(notificationArea);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        notificationArea.appendChild(notification);
        
        // Animación de entrada
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }, 10);
    }

    // ⚠️ Mostrar modal de límite alcanzado
    showLimitReachedModal() {
        if (document.querySelector('.limit-modal')) return;
        
        const modal = document.createElement('div');
        modal.className = 'limit-modal';
        modal.innerHTML = `
            <div class="limit-modal-content">
                <h3><i class="fas fa-lock"></i> Límite alcanzado</h3>
                <p>Has usado tus ${this.maxFreeConversations} conversaciones gratuitas.</p>
                <p><strong>Regístrate para obtener acceso ilimitado:</strong></p>
                <ul class="benefits-list">
                    <li><i class="fas fa-infinity"></i> Conversaciones ilimitadas</li>
                    <li><i class="fas fa-cloud-upload-alt"></i> Exportación avanzada</li>
                    <li><i class="fas fa-palette"></i> Temas personalizados</li>
                    <li><i class="fas fa-robot"></i> Modelos IA premium</li>
                    <li><i class="fas fa-history"></i> Historial ilimitado</li>
                </ul>
                <div class="modal-actions">
                    <button class="btn-primary" id="register-now">Registrarme ahora</button>
                    <button class="btn-secondary" id="close-limit-modal">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('register-now').onclick = () => {
            modal.remove();
            this.showAuthModal();
        };
        
        document.getElementById('close-limit-modal').onclick = () => {
            modal.remove();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    // 🪟 Mostrar modal de autenticación
    showAuthModal() {
        if (document.querySelector('.auth-modal')) return;
        
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-content">
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Iniciar Sesión</button>
                    <button class="auth-tab" data-tab="register">Registrarse</button>
                </div>
                
                <div class="auth-form active" id="login-form">
                    <div class="form-group">
                        <label><i class="fas fa-envelope"></i> Correo electrónico</label>
                        <input type="email" id="login-email" placeholder="tucorreo@ejemplo.com">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Contraseña</label>
                        <input type="password" id="login-password" placeholder="Tu contraseña">
                    </div>
                    <button class="btn-primary" id="submit-login">Iniciar Sesión</button>
                </div>
                
                <div class="auth-form" id="register-form">
                    <div class="form-group">
                        <label><i class="fas fa-envelope"></i> Correo electrónico</label>
                        <input type="email" id="register-email" placeholder="tucorreo@ejemplo.com">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Contraseña</label>
                        <input type="password" id="register-password" placeholder="Mínimo 6 caracteres">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Confirmar Contraseña</label>
                        <input type="password" id="register-confirm" placeholder="Repite tu contraseña">
                    </div>
                    <button class="btn-primary" id="submit-register">Crear Cuenta</button>
                </div>
                
                <div class="auth-footer">
                    <p><small>Al registrarte aceptas nuestros <a href="#" onclick="return false;">Términos de servicio</a></small></p>
                </div>
                
                <button class="close-auth-modal">&times;</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Cambiar entre pestañas
        modal.querySelectorAll('.auth-tab').forEach(tab => {
            tab.onclick = () => {
                modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                modal.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
            };
        });
        
        // Iniciar sesión
        document.getElementById('submit-login').onclick = async () => {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                this.showNotification('Por favor completa todos los campos', 'error');
                return;
            }
            
            if (!this.validateEmail(email)) {
                this.showNotification('Correo electrónico inválido', 'error');
                return;
            }
            
            const result = await this.login(email, password);
            if (result.success) {
                modal.remove();
            }
        };
        
        // Registrarse
        document.getElementById('submit-register').onclick = async () => {
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            
            if (!email || !password || !confirm) {
                this.showNotification('Por favor completa todos los campos', 'error');
                return;
            }
            
            if (!this.validateEmail(email)) {
                this.showNotification('Correo electrónico inválido', 'error');
                return;
            }
            
            if (password !== confirm) {
                this.showNotification('Las contraseñas no coinciden', 'error');
                return;
            }
            
            if (password.length < 6) {
                this.showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
                return;
            }
            
            const result = await this.register(email, password);
            if (result.success) {
                modal.remove();
            }
        };
        
        // Cerrar modal
        modal.querySelector('.close-auth-modal').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    // 👑 Mostrar funciones premium
    showPremiumFeatures() {
        const premiumSection = document.getElementById('premium-features');
        if (!premiumSection) return;
        
        premiumSection.style.display = 'block';
        const premiumList = premiumSection.querySelector('.premium-list');
        
        if (this.isPremium) {
            premiumList.innerHTML = `
                <div class="premium-item active">
                    <i class="fas fa-check-circle"></i>
                    <span>Modelos IA avanzados</span>
                </div>
                <div class="premium-item active">
                    <i class="fas fa-check-circle"></i>
                    <span>Exportación PNG/PDF</span>
                </div>
                <div class="premium-item active">
                    <i class="fas fa-check-circle"></i>
                    <span>Voz personalizada</span>
                </div>
                <div class="premium-item active">
                    <i class="fas fa-check-circle"></i>
                    <span>Soporte prioritario</span>
                </div>
                <div class="premium-item active">
                    <i class="fas fa-check-circle"></i>
                    <span>Sin límites de uso</span>
                </div>
            `;
        } else {
            premiumList.innerHTML = `
                <div class="premium-item">
                    <i class="fas fa-lock"></i>
                    <span>Modelos IA avanzados</span>
                </div>
                <div class="premium-item">
                    <i class="fas fa-lock"></i>
                    <span>Exportación PNG/PDF</span>
                </div>
                <div class="premium-item">
                    <i class="fas fa-lock"></i>
                    <span>Voz personalizada</span>
                </div>
                <div class="premium-item">
                    <i class="fas fa-lock"></i>
                    <span>Soporte prioritario</span>
                </div>
                <div class="premium-item">
                    <i class="fas fa-lock"></i>
                    <span>Sin límites de uso</span>
                </div>
                <button class="btn-upgrade" onclick="window.authSystem.showUpgradeModal()">
                    <i class="fas fa-crown"></i> Actualizar a Premium
                </button>
            `;
        }
    }

    // 🔒 Ocultar funciones premium
    hidePremiumFeatures() {
        const premiumSection = document.getElementById('premium-features');
        if (premiumSection) {
            premiumSection.style.display = 'none';
        }
    }

    // 💎 Mostrar modal de actualización a Premium
    showUpgradeModal() {
        if (document.querySelector('.upgrade-modal')) return;
        
        const modal = document.createElement('div');
        modal.className = 'upgrade-modal';
        modal.innerHTML = `
            <div class="upgrade-modal-content">
                <h3><i class="fas fa-crown"></i> Actualizar a Premium</h3>
                <p>Desbloquea todas las funciones avanzadas de AndreaAI</p>
                
                <div class="pricing-plans">
                    <div class="plan">
                        <h4>Mensual</h4>
                        <div class="price">$9.99<span>/mes</span></div>
                        <ul class="plan-features">
                            <li><i class="fas fa-check"></i> Todo lo de Gratis</li>
                            <li><i class="fas fa-check"></i> Modelos IA avanzados</li>
                            <li><i class="fas fa-check"></i> Exportación ilimitada</li>
                            <li><i class="fas fa-check"></i> Voz ElevenLabs</li>
                            <li><i class="fas fa-check"></i> Soporte prioritario</li>
                        </ul>
                        <button class="btn-primary" onclick="window.authSystem.upgradeToPremium('monthly')">
                            Elegir Mensual
                        </button>
                    </div>
                    
                    <div class="plan popular">
                        <div class="badge">Más popular</div>
                        <h4>Anual</h4>
                        <div class="price">$99.99<span>/año</span></div>
                        <div class="savings">Ahorras $19.89</div>
                        <ul class="plan-features">
                            <li><i class="fas fa-check"></i> Todo lo de Mensual</li>
                            <li><i class="fas fa-check"></i> 2 meses gratis</li>
                            <li><i class="fas fa-check"></i> Temas exclusivos</li>
                            <li><i class="fas fa-check"></i> Estadísticas avanzadas</li>
                            <li><i class="fas fa-check"></i> Acceso beta</li>
                        </ul>
                        <button class="btn-primary" onclick="window.authSystem.upgradeToPremium('yearly')">
                            Elegir Anual
                        </button>
                    </div>
                </div>
                
                <div class="payment-methods">
                    <p>Métodos de pago:</p>
                    <div class="methods">
                        <i class="fab fa-cc-paypal" title="PayPal"></i>
                        <i class="fab fa-cc-stripe" title="Stripe"></i>
                        <i class="fab fa-cc-visa" title="Visa"></i>
                        <i class="fab fa-cc-mastercard" title="Mastercard"></i>
                        <i class="fab fa-cc-amex" title="American Express"></i>
                    </div>
                </div>
                
                <button class="close-upgrade-modal">&times;</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-upgrade-modal').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    // 💳 Actualizar a Premium (simulación)
    async upgradeToPremium(plan) {
        this.showNotification('Redirigiendo a PayPal para completar el pago...', 'info');
        
        // Simulación - en producción esto sería una integración real
        return new Promise(resolve => {
            setTimeout(() => {
                this.isPremium = true;
                this.showPremiumFeatures();
                this.updateUI();
                this.showNotification('¡Ahora eres usuario Premium!', 'success');
                
                // Cerrar modal de upgrade si existe
                const modal = document.querySelector('.upgrade-modal');
                if (modal) modal.remove();
                
                // Actualizar en Firestore
                if (this.user && this.authInitialized) {
                    this.db.collection('users').doc(this.user.uid).update({
                        premium: true,
                        premiumSince: firebase.firestore.FieldValue.serverTimestamp(),
                        premiumPlan: plan
                    });
                }
                
                resolve(true);
            }, 2000);
        });
    }

    // ❓ Obtener mensaje de error amigable
    getErrorMessage(errorCode) {
        const messages = {
            'auth/email-already-in-use': 'Este correo ya está registrado',
            'auth/invalid-email': 'Correo electrónico inválido',
            'auth/operation-not-allowed': 'Operación no permitida',
            'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
            'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contraseña incorrecta',
            'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
            'auth/network-request-failed': 'Error de red. Verifica tu conexión',
            'auth/requires-recent-login': 'Por favor, vuelve a iniciar sesión'
        };
        
        return messages[errorCode] || 'Error desconocido. Intenta de nuevo.';
    }

    // 🔧 Métodos de utilidad
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    truncateEmail(email, maxLength = 20) {
        if (email.length <= maxLength) return email;
        return email.substring(0, maxLength - 3) + '...';
    }
}

// 🌐 EXPORTAR PARA USO GLOBAL
window.AuthSystem = AuthSystem;

// 🔄 Integración con AndreaApp
function integrateAuthWithApp() {
    if (window.app && window.authSystem) {
        // Sobrescribir método sendMessage para incluir límite
        const originalSendMessage = window.app.sendMessage;
        
        window.app.sendMessage = async function() {
            // Verificar límite de conversaciones
            if (!window.authSystem.canChat()) {
                this.appendMessage('ai', `
                    🔒 **Límite alcanzado**
                    
                    Has usado tus 3 conversaciones gratuitas. 
                    **Regístrate para obtener acceso ilimitado:**
                    
                    • Conversaciones ilimitadas
                    • Exportación avanzada
                    • Modelos IA premium
                    • Historial ilimitado
                    
                    Haz clic en "Iniciar sesión" en la barra lateral para continuar.
                `);
                return;
            }
            
            // Incrementar contador
            await window.authSystem.incrementConversationCount();
            
            // Llamar al método original
            return originalSendMessage.apply(this, arguments);
        };
        
        console.log('✅ Sistema de autenticación integrado con AndreaApp');
    }
}

// 🎨 CSS para el sistema de autenticación
const authStyles = `
/* 🔐 ESTILOS DE AUTENTICACIÓN */
.auth-section {
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 16px;
    background: rgba(0,0,0,0.2);
    border-radius: var(--radius-m);
}

.auth-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.btn-auth {
    background: linear-gradient(135deg, var(--primary-accent), var(--accent-teal));
    border: none;
    color: white;
    padding: 10px 16px;
    border-radius: var(--radius-s);
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    flex: 1;
    justify-content: center;
}

.btn-auth:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-s);
}

.user-info {
    font-size: 0.8rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
}

.user-status .premium {
    color: #FFD700;
}

.user-status .free {
    color: var(--primary-accent);
}

.conversation-counter {
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding: 8px;
    background: rgba(255,255,255,0.05);
    border-radius: var(--radius-s);
    margin-bottom: 12px;
}

.premium-features {
    background: rgba(255, 215, 0, 0.1);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: var(--radius-s);
    padding: 12px;
}

.premium-features h4 {
    color: #FFD700;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
}

.premium-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.premium-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--text-secondary);
}

.premium-item.active {
    color: var(--primary-accent);
}

.premium-item .fa-lock {
    color: var(--text-muted);
}

.btn-upgrade {
    width: 100%;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    border: none;
    color: #000;
    padding: 10px;
    border-radius: var(--radius-s);
    cursor: pointer;
    font-weight: bold;
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
}

.btn-upgrade:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

/* MODALES DE AUTENTICACIÓN */
.auth-modal, .limit-modal, .upgrade-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
}

.auth-modal-content, .limit-modal-content, .upgrade-modal-content {
    background: var(--bg-card);
    border-radius: var(--radius-l);
    width: 90%;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    border: 1px solid var(--border-subtle);
    box-shadow: var(--shadow-l);
}

.limit-modal-content, .upgrade-modal-content {
    max-width: 500px;
}

.auth-tabs {
    display: flex;
    background: var(--bg-sidebar);
    border-bottom: 1px solid var(--border-subtle);
}

.auth-tab {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-muted);
    padding: 16px;
    cursor: pointer;
    font-size: 0.9rem;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
}

.auth-tab:hover {
    color: var(--text-main);
}

.auth-tab.active {
    color: var(--primary-accent);
    border-bottom-color: var(--primary-accent);
    background: rgba(100, 181, 246, 0.1);
}

.auth-form {
    padding: 24px;
    display: none;
}

.auth-form.active {
    display: block;
    animation: fadeIn 0.3s;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
}

.form-group input {
    width: 100%;
    padding: 12px 16px;
    background: var(--bg-input);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-s);
    color: white;
    font-size: 0.9rem;
    outline: none;
}

.form-group input:focus {
    border-color: var(--primary-accent);
    box-shadow: 0 0 0 2px rgba(100, 181, 246, 0.2);
}

.btn-primary {
    width: 100%;
    background: linear-gradient(135deg, var(--primary-accent), var(--accent-teal));
    border: none;
    color: white;
    padding: 14px;
    border-radius: var(--radius-m);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    transition: all 0.2s;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-m);
}

.btn-secondary {
    width: 100%;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    padding: 14px;
    border-radius: var(--radius-m);
    cursor: pointer;
    font-size: 0.95rem;
    transition: all 0.2s;
}

.btn-secondary:hover {
    border-color: var(--primary-accent);
    color: var(--primary-accent);
}

.auth-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);
    text-align: center;
    color: var(--text-muted);
    font-size: 0.8rem;
}

.close-auth-modal, .close-upgrade-modal {
    position: absolute;
    top: 16px;
    right: 16px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}

.close-auth-modal:hover, .close-upgrade-modal:hover {
    background: rgba(255,255,255,0.1);
    color: var(--secondary-accent);
}

.benefits-list {
    list-style: none;
    padding: 0;
    margin: 20px 0;
}

.benefits-list li {
    padding: 8px 0;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 10px;
}

.modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
}

/* PLANES DE PRECIOS */
.pricing-plans {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin: 24px 0;
}

.plan {
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-m);
    padding: 24px;
    text-align: center;
    position: relative;
}

.plan.popular {
    border-color: var(--primary-accent);
    background: rgba(100, 181, 246, 0.1);
}

.badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary-accent);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: bold;
}

.plan h4 {
    color: var(--primary-accent);
    margin-bottom: 16px;
}

.price {
    font-size: 2rem;
    font-weight: bold;
    color: white;
    margin-bottom: 8px;
}

.price span {
    font-size: 1rem;
    color: var(--text-muted);
}

.savings {
    color: #4caf50;
    font-size: 0.8rem;
    margin-bottom: 16px;
}

.plan-features {
    list-style: none;
    padding: 0;
    margin: 20px 0;
    text-align: left;
}

.plan-features li {
    padding: 6px 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 8px;
}

.plan-features li i {
    color: #4caf50;
}

.payment-methods {
    text-align: center;
    padding: 20px;
    border-top: 1px solid var(--border-subtle);
}

.methods {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 12px;
    font-size: 1.5rem;
    color: var(--text-muted);
}

/* ANIMACIONES */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* MENSAJES DEL CHAT */
.message-wrapper {
    margin-bottom: 16px;
    display: flex;
    animation: fadeIn 0.3s ease;
}

.message-wrapper.user {
    justify-content: flex-end;
}

.message-content {
    max-width: 75%;
    padding: 12px 16px;
    border-radius: 18px;
    line-height: 1.5;
}

.user .message-content {
    background: linear-gradient(135deg, var(--primary-accent), var(--accent-teal));
    color: white;
}

.ai .message-content {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    color: var(--text-main);
}

.typing .message-content {
    background: transparent;
    border: none;
    padding: 10px 16px;
}

.typing-dots {
    display: flex;
    gap: 4px;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    background: var(--text-muted);
    border-radius: 50%;
    animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-5px); opacity: 1; }
}

/* NOTIFICACIONES */
#notification-area {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 10000;
    pointer-events: none;
}

.notification {
    background: var(--bg-card);
    border-left: 4px solid var(--primary-accent);
    color: white;
    padding: 16px 20px;
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-l);
    display: flex;
    align-items: center;
    gap: 14px;
    transform: translateX(120px);
    opacity: 0;
    transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    pointer-events: auto;
    max-width: 320px;
    backdrop-filter: blur(10px);
}

.notification.show {
    transform: translateX(0);
    opacity: 1;
}

.notification.success {
    border-left-color: #4caf50;
    background: rgba(76, 175, 80, 0.1);
}

.notification.error {
    border-left-color: #f44336;
    background: rgba(244, 67, 54, 0.1);
}

.notification i {
    font-size: 1.3rem;
}
`;

// Añadir estilos al documento
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = authStyles;
    document.head.appendChild(style);
});

// 🔄 Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar sistema de autenticación
    window.authSystem = new AuthSystem();
    
    // Integrar con AndreaApp después de un breve retraso
    setTimeout(() => {
        integrateAuthWithApp();
        console.log('✅ Sistema completo inicializado');
    }, 1500);
});

console.log('🔐 Sistema de autenticación cargado');
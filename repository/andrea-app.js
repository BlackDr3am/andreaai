// 📁 andrea-app.js - APLICACIÓN PRINCIPAL INTEGRADA CON AUTH-SYSTEM

class AndreaApp {
    constructor() {
        this.messages = [];
        this.isTyping = false;
        this.currentSection = 'chat';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.setupChat();
        this.setupMindMap();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.showSection(section);
            });
        });

        // Botón enviar mensaje
        const sendBtn = document.getElementById('send-btn');
        const userInput = document.getElementById('user-input');
        
        if (sendBtn && userInput) {
            sendBtn.addEventListener('click', () => this.sendMessage());
            userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Botón limpiar chat
        const clearChatBtn = document.getElementById('clear-chat');
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => this.clearChat());
        }

        // Botón exportar chat
        const exportChatBtn = document.getElementById('export-chat');
        if (exportChatBtn) {
            exportChatBtn.addEventListener('click', () => this.exportChat());
        }
    }

    setupNavigation() {
        // Activar navegación actual
        this.showSection('chat');
    }

    showSection(sectionId) {
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Mostrar sección seleccionada
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Actualizar navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            }
        });
        
        this.currentSection = sectionId;
    }

    setupChat() {
        // Configuración inicial del chat
        this.updateChatUI();
    }

    async sendMessage() {
        const input = document.getElementById('user-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Verificar límite de conversaciones si existe authSystem
        if (window.authSystem && !window.authSystem.canChat()) {
            this.appendMessage('ai', `
                🔒 **Límite alcanzado**
                
                Has usado tus conversaciones gratuitas. 
                **Regístrate para obtener acceso ilimitado:**
                
                • Conversaciones ilimitadas
                • Exportación avanzada
                • Modelos IA premium
                • Historial ilimitado
                
                Haz clic en "Iniciar sesión" en la barra lateral para continuar.
            `);
            return;
        }
        
        // Limpiar input
        input.value = '';
        
        // Añadir mensaje del usuario
        this.appendMessage('user', message);
        
        // Mostrar estado de escritura
        this.showTypingIndicator();
        
        // Incrementar contador de conversaciones si existe authSystem
        if (window.authSystem) {
            await window.authSystem.incrementConversationCount();
        }
        
        // Simular respuesta de IA (en producción, aquí llamarías a la API)
        setTimeout(() => {
            this.hideTypingIndicator();
            this.appendMessage('ai', this.generateResponse(message));
        }, 1500);
    }

    appendMessage(sender, content) {
        const chatContainer = document.getElementById('chat-box');
        if (!chatContainer) return;
        
        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message-wrapper ${sender}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = content;
        
        messageWrapper.appendChild(messageContent);
        chatContainer.appendChild(messageWrapper);
        
        // Scroll al final
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Guardar mensaje
        this.messages.push({ sender, content, timestamp: new Date() });
    }

    showTypingIndicator() {
        const chatContainer = document.getElementById('chat-box');
        if (!chatContainer) return;
        
        this.isTyping = true;
        
        const typingWrapper = document.createElement('div');
        typingWrapper.className = 'message-wrapper ai typing';
        typingWrapper.id = 'typing-indicator';
        
        const typingContent = document.createElement('div');
        typingContent.className = 'message-content';
        typingContent.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        typingWrapper.appendChild(typingContent);
        chatContainer.appendChild(typingWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    generateResponse(message) {
        const responses = {
            'quién te creó': 'Fui creada por IsaDetaSeek como un sistema neural avanzado.',
            'hola': '¡Hola! Soy AndreaAI, tu asistente neural. ¿En qué puedo ayudarte?',
            'ayuda': 'Puedo ayudarte con: análisis de datos, mapas mentales, generación de contenido y más.',
            'preset': 'Puedes usar /preset [nombre] para cambiar mi personalidad.',
            'clear': 'Usa /clear para limpiar el chat.',
            'export': 'Usa /export [formato] para exportar la conversación.'
        };
        
        const lowerMessage = message.toLowerCase();
        
        for (const [key, response] of Object.entries(responses)) {
            if (lowerMessage.includes(key)) {
                return response;
            }
        }
        
        return `He procesado tu mensaje: "${message}". Como sistema neural, puedo ayudarte con análisis, mapas mentales, generación de contenido y más. ¿Te gustaría que profundice en algún tema específico?`;
    }

    clearChat() {
        const chatContainer = document.getElementById('chat-box');
        if (!chatContainer) return;
        
        chatContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-microchip empty-icon"></i>
                <h2>AndreaAI v5.0</h2>
                <p>Sistema neural completo con todas las funciones</p>
                <div class="empty-hints">
                    <span class="hint">💡 Pregunta: "¿quién te creó?"</span>
                    <span class="hint">🧠 Comando: /preset [nombre]</span>
                    <span class="hint">🗑️ Comando: /clear</span>
                    <span class="hint">🎤 Comando: /voice</span>
                    <span class="hint">📤 Comando: /export [formato]</span>
                </div>
            </div>
        `;
        
        this.messages = [];
    }

    exportChat() {
        if (this.messages.length === 0) {
            this.showNotification('No hay mensajes para exportar', 'error');
            return;
        }
        
        const exportContent = this.messages.map(msg => {
            const sender = msg.sender === 'user' ? 'Usuario' : 'AndreaAI';
            const time = msg.timestamp.toLocaleTimeString();
            return `[${time}] ${sender}: ${msg.content}`;
        }).join('\n\n');
        
        const blob = new Blob([exportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `andreaai-chat-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Chat exportado correctamente', 'success');
    }

    setupMindMap() {
        // Configuración inicial del mapa mental
        const mindStats = document.getElementById('mind-stats');
        if (mindStats) {
            mindStats.innerHTML = `
                <span><i class="fas fa-circle-nodes"></i> Nodos: 0</span>
                <span><i class="fas fa-link"></i> Conexiones: 0</span>
            `;
        }
    }

    checkAuthStatus() {
        // Integración con auth-system
        if (window.authSystem) {
            // Actualizar UI cuando cambie el estado de autenticación
            const updateAuthUI = () => {
                const userInput = document.getElementById('user-input');
                const sendBtn = document.getElementById('send-btn');
                
                if (userInput && sendBtn) {
                    if (window.authSystem.user) {
                        userInput.placeholder = 'Escribe un mensaje o comando...';
                        userInput.disabled = false;
                        sendBtn.disabled = false;
                    } else {
                        userInput.placeholder = window.authSystem.canChat() 
                            ? 'Escribe un mensaje o comando...' 
                            : 'Regístrate para continuar chateando';
                        userInput.disabled = !window.authSystem.canChat();
                        sendBtn.disabled = !window.authSystem.canChat();
                    }
                }
            };
            
            // Escuchar cambios en authSystem
            setInterval(updateAuthUI, 1000);
        }
    }

    updateChatUI() {
        // Actualizar UI del chat según estado
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (userInput && sendBtn) {
            if (window.authSystem && !window.authSystem.canChat()) {
                userInput.placeholder = 'Regístrate para continuar chateando';
                userInput.disabled = true;
                sendBtn.disabled = true;
            }
        }
    }

    showNotification(message, type = 'info') {
        // Usar el sistema de notificaciones de auth-system si existe
        if (window.authSystem && window.authSystem.showNotification) {
            window.authSystem.showNotification(message, type);
        } else {
            // Notificación simple
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AndreaApp();
    console.log('🚀 AndreaApp inicializada');
});
class ChatBot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Send button click event
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key press event
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Input change event to enable/disable send button
        this.messageInput.addEventListener('input', () => {
            this.sendButton.disabled = this.messageInput.value.trim() === '';
        });
        
        // Initially disable send button
        this.sendButton.disabled = true;
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Clear input and disable send button
        this.messageInput.value = '';
        this.sendButton.disabled = true;
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send message to backend
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });
            
            const data = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            if (response.ok) {
                // Add bot response to chat
                this.addMessage(data.message, 'bot');
            } else {
                // Show error message
                this.addMessage(`Hata: ${data.error || 'Bilinmeyen bir hata oluştu.'}`, 'bot');
            }
        } catch (error) {
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Show error message
            this.addMessage(`Bağlantı hatası: ${error.message}`, 'bot');
        }
    }
    
    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = sender === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textP = document.createElement('p');
        textP.textContent = content;
        contentDiv.appendChild(textP);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Initialize chat bot when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});


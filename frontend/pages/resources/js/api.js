// API Client for SkillSwap Frontend
class SkillSwapAPI {
  constructor() {
    this.baseURL = window.location.origin;
    this.apiURL = `${this.baseURL}/api`;
    this.token = localStorage.getItem('skillswap_token');
    this.user = JSON.parse(localStorage.getItem('skillswap_user') || 'null');
  }

  // Helper method to make API requests
  async request(endpoint, options = {}) {
    const url = `${this.apiURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add authorization header if token exists
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication methods
  async register(userData) {
    const data = await this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (data.token) {
      this.setAuth(data.token, data.user);
    }

    return data;
  }

  async login(credentials) {
    const data = await this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (data.token) {
      this.setAuth(data.token, data.user);
    }

    return data;
  }

  async logout() {
    try {
      await this.request('/users/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('skillswap_token', token);
    localStorage.setItem('skillswap_user', JSON.stringify(user));
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('skillswap_token');
    localStorage.removeItem('skillswap_user');
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  getCurrentUser() {
    return this.user;
  }

  // User methods
  async getProfile() {
    return await this.request('/users/profile');
  }

  async updateProfile(updates) {
    const data = await this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });

    if (data.user) {
      this.user = data.user;
      localStorage.setItem('skillswap_user', JSON.stringify(data.user));
    }

    return data;
  }

  async getUserProfile(userId) {
    return await this.request(`/users/${userId}`);
  }

  // Skills methods
  async getSkills(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/skills?${queryString}`);
  }

  async getSkillCategories() {
    return await this.request('/skills/categories');
  }

  async getPopularSkills(limit = 10) {
    return await this.request(`/skills/popular?limit=${limit}`);
  }

  async getSkill(skillId) {
    return await this.request(`/skills/${skillId}`);
  }

  async getSkillUsers(skillId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/skills/${skillId}/users?${queryString}`);
  }

  // Swap methods
  async getSwaps(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/swaps?${queryString}`);
  }

  async createSwap(swapData) {
    return await this.request('/swaps', {
      method: 'POST',
      body: JSON.stringify(swapData)
    });
  }

  async getSwap(swapId) {
    return await this.request(`/swaps/${swapId}`);
  }

  async updateSwapStatus(swapId, status, message = '') {
    return await this.request(`/swaps/${swapId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, message })
    });
  }

  async cancelSwap(swapId) {
    return await this.request(`/swaps/${swapId}`, {
      method: 'DELETE'
    });
  }

  async getSwapMessages(swapId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/swaps/${swapId}/messages?${queryString}`);
  }

  // Search methods
  async searchUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/search/users?${queryString}`);
  }

  async searchSkills(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/search/skills?${queryString}`);
  }

  async getSearchSuggestions(query, type = 'all') {
    return await this.request(`/search/suggestions?q=${encodeURIComponent(query)}&type=${type}`);
  }

  async getAutocomplete(query, type = 'all') {
    return await this.request(`/search/autocomplete?q=${encodeURIComponent(query)}&type=${type}`);
  }

  async advancedSearch(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await this.request(`/search/advanced?${queryString}`);
  }

  // Health check
  async healthCheck() {
    return await this.request('/health');
  }

  // Utility methods
  formatError(error) {
    if (typeof error === 'string') {
      return error;
    }
    return error.message || 'An unexpected error occurred';
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    // Add to page
    document.body.appendChild(notification);

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async handleRequest(requestFn, showNotification = true) {
    try {
      const result = await requestFn();
      if (showNotification && result.message) {
        this.showNotification(result.message, 'success');
      }
      return result;
    } catch (error) {
      const message = this.formatError(error);
      if (showNotification) {
        this.showNotification(message, 'error');
      }
      throw error;
    }
  }
}

// Create global API instance
const api = new SkillSwapAPI();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SkillSwapAPI;
} else {
  window.SkillSwapAPI = SkillSwapAPI;
  window.api = api;
} 
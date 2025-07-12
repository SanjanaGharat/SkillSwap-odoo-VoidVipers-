const API_BASE_URL = 'http://localhost:3000/api';

class SkillSwapAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async login(credentials) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    this.setToken(data.token);
    return data;
  }

  async logout() {
    this.clearToken();
  }

  // User Management
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async updateProfile(userData) {
    return this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  }

  async getAllUsers() {
    return this.request('/users');
  }

  async getUserById(userId) {
    return this.request(`/users/${userId}`);
  }

  // Skills Management
  async getUserSkills() {
    return this.request('/skills');
  }

  async addSkill(skillData) {
    return this.request('/skills', {
      method: 'POST',
      body: JSON.stringify(skillData)
    });
  }

  async updateSkill(skillId, skillData) {
    return this.request(`/skills/${skillId}`, {
      method: 'PUT',
      body: JSON.stringify(skillData)
    });
  }

  async deleteSkill(skillId) {
    return this.request(`/skills/${skillId}`, {
      method: 'DELETE'
    });
  }

  // Swap Requests
  async createSwapRequest(requestData) {
    return this.request('/swaps', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
  }

  async getSwapRequests() {
    return this.request('/swaps');
  }

  async updateSwapRequest(requestId, status) {
    return this.request(`/swaps/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Search
  async searchUsers(query) {
    return this.request(`/search/users?q=${encodeURIComponent(query)}`);
  }

  async searchSkills(query) {
    return this.request(`/search/skills?q=${encodeURIComponent(query)}`);
  }
}

export default new SkillSwapAPI(); 
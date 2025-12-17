// src/services/api.service.ts

const API_URL = "/api";

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

class ApiService {
    private token: string | null = null;

    constructor() {
        if (typeof window !== "undefined") {
            this.token = localStorage.getItem("auth_token");
        }
    }

    private buildHeaders(includeAuth: boolean, body?: BodyInit | null): HeadersInit {
        const headers: Record<string, string> = {};

        if (!(body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }

        if (includeAuth && this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }

        return headers;
    }

    private async request(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<any> {
        const url = `${API_URL}${endpoint}`;
        const includeAuth = options.skipAuth ? false : true;
        const headers = this.buildHeaders(includeAuth, options.body ?? null);

        const res = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...(options.headers || {}),
            },
        });

        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
            let errBody: any = {};
            if (contentType.includes("application/json")) {
                errBody = await res.json().catch(() => ({}));
            } else {
                const text = await res.text().catch(() => "");
                errBody = { message: text };
            }

            const msg =
                errBody?.error?.message ||
                errBody?.error ||
                errBody?.message ||
                `HTTP ${res.status}`;
            throw new Error(msg);
        }

        if (contentType.includes("application/json")) {
            return res.json();
        }

        return res.text().catch(() => "");
    }

    // ========== Token Management ==========
    setToken(token: string) {
        this.token = token;
        localStorage.setItem("auth_token", token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem("auth_token");
    }

    getToken() {
        return this.token;
    }

    isAuthenticated() {
        return !!this.token;
    }

    // ========== Auth Routes ==========
    async signup(email: string, password: string, fullName: string) {
        const data = await this.request("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ email, password, fullName }),
            skipAuth: true,
        });

        if (data.token) {
            this.setToken(data.token);
        }

        return data;
    }

    async login(email: string, password: string) {
        const data = await this.request("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
            skipAuth: true,
        });

        if (data.token) {
            this.setToken(data.token);
        }

        return data;
    }

    async logout() {
        this.clearToken();
    }

    async getCurrentUser() {
        return this.request("/auth/me");
    }

    // ========== Products Routes ==========

    // ✅ FIXED: Now accepts 3 arguments to match ProductDetail.tsx and support sub-categories
    async getProducts(category?: string | null, subCategory?: string | null, search?: string | null) {
        const params = new URLSearchParams();

        if (category && category !== 'all') params.append("category", category);
        if (subCategory && subCategory !== 'all') params.append("sub_category", subCategory);
        if (search) params.append("search", search);

        const query = params.toString() ? `?${params.toString()}` : "";
        return this.request(`/products${query}`, { method: "GET" });
    }

    async getProduct(id: string) {
        return this.request(`/products/${id}`, { method: "GET" });
    }

    /**
     * Create product.
     * Accepts either a plain object (will be JSON-stringified) or a FormData (multipart upload).
     */
    async createProduct(productData: any | FormData) {
        const isForm = productData instanceof FormData;

        return this.request("/products", {
            method: "POST",
            body: isForm ? productData : JSON.stringify(productData),
        });
    }

    /**
     * Backwards-compatible alias for explicit FormData uploads.
     */
    async createProductWithImage(formData: FormData) {
        return this.createProduct(formData);
    }

    /**
     * Update product.
     * Accepts either a plain object (JSON) or a FormData (multipart upload to replace image).
     */
    async updateProduct(id: string, productData: any | FormData) {
        const isForm = productData instanceof FormData;

        return this.request(`/products/${id}`, {
            method: "PUT",
            body: isForm ? productData : JSON.stringify(productData),
        });
    }

    /**
     * Backwards-compatible alias for explicit FormData uploads.
     */
    async updateProductWithImage(productId: string, formData: FormData) {
        return this.updateProduct(productId, formData);
    }


    async deleteProduct(id: string) {
        return this.request(`/products/${id}`, { method: "DELETE" });
    }

    // ========== Cart Routes ==========
    async getCart() {
        return this.request("/cart");
    }

    async addToCart(productId: string, quantity: number = 1) {
        return this.request("/cart/items", {
            method: "POST",
            body: JSON.stringify({ product_id: productId, quantity }),
        });
    }

    async updateCartItem(productId: string, quantity: number) {
        return this.request(`/cart/items/${productId}`, {
            method: "PUT",
            body: JSON.stringify({ quantity }),
        });
    }

    async removeFromCart(productId: string) {
        return this.request(`/cart/items/${productId}`, {
            method: "DELETE",
        });
    }

    async clearCart() {
        return this.request("/cart", {
            method: "DELETE",
        });
    }

    // ========== Orders Routes ==========
    async getOrders() {
        return this.request("/orders", { method: "GET" });
    }

    async getOrder(id: string) {
        return this.request(`/orders/${id}`, { method: "GET" });
    }

    async createOrder(items: any[], totalAmount: number, shippingAddress: any, paymentGateway: string, shippingAmount: number) {
        return this.request('/orders', {
            method: 'POST',
            body: JSON.stringify({
                items,
                totalAmount,
                shippingAddress,
                paymentGateway,
                shippingAmount // ✅ Sending this to backend
            }),
        });
    }

    // ========== CUSTOMER ORDER ACTIONS ==========

    async cancelOrder(orderId: string) {
        return this.request(`/orders/${orderId}/cancel`, { method: "POST" });
    }

    async updateOrderAddress(orderId: string, address: any) {
        return this.request(`/orders/${orderId}/address`, {
            method: "PUT",
            body: JSON.stringify({ address })
        });
    }

    async updateOrderStatus(id: string, status: string) {
        return this.request(`/orders/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status }),
        });
    }

    async getAdminOrders() {
        return this.request("/orders/admin/all", { method: "GET" });
    }

    // ===== REVIEWS =====
    async getProductReviews(productId: string) {
        return this.request(`/products/${productId}/reviews`, { method: "GET" });
    }

    async addProductReview(productId: string, rating: number, comment: string) {
        return this.request(`/products/${productId}/reviews`, {
            method: "POST",
            body: JSON.stringify({ rating, comment }),
        });
    }

    // ===== LIKE METHODS =====
    async isProductLiked(productId: string) {
        return this.request(`/products/${productId}/likes`);
    }

    async likeProduct(productId: string) {
        return this.request(`/products/${productId}/like`, { method: 'POST' });
    }

    async unlikeProduct(productId: string) {
        return this.request(`/products/${productId}/like`, { method: 'DELETE' });
    }

    async forgotPassword(email: string) {
        return this.request("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
            skipAuth: true,
        });
    }

    async resetPassword(token: string, newPassword: string) {
        return this.request("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, newPassword }),
            skipAuth: true,
        });
    }

    async sendQuoteRequest(formData: FormData) {
        // Note: When sending FormData, DO NOT set Content-Type header manually
        // The browser sets it automatically with the boundary
        return this.request("/quotes/request", {
            method: "POST",
            body: formData,
            // Custom option to tell our request helper NOT to enforce JSON
            // You might need to adjust your buildHeaders method to handle FormData check
        });
    }

}

export const apiService = new ApiService();
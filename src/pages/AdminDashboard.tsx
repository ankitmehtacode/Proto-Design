    import { useEffect, useState } from 'react';
    import { useNavigate } from 'react-router-dom';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Textarea } from '@/components/ui/textarea';
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from '@/components/ui/select';
    import { Badge } from '@/components/ui/badge';
    import { toast } from 'sonner';
    import {
    Loader2,
    Package,
    ShoppingCart,
    DollarSign,
    TrendingUp,
    Plus,
    AlertTriangle,
    Edit3,
    Save,
    X,
    ChevronRight,
    Upload, Search,
    Calendar as CalendarIcon, Trash2
} from 'lucide-react';
    import { formatINR } from '@/lib/currency';
    import { apiService } from '@/services/api.service';
    import ProductPreviewCarousel from '@/components/ProductPreviewCarousel';

    // CONFIGURATION
    const MAIN_CATEGORIES = [
        { value: '3d_printer', label: '3D Printer' },
        { value: '3dprintables', label: '3D Printable' },
        { value: 'filament', label: 'Filament' },
        { value: 'resin', label: 'Resin' },
        { value: 'accessory', label: 'Accessory' },
        { value: 'spare_part', label: 'Spare Part' },
    ];

    const SUB_CATEGORIES: Record<string, string[]> = {
        '3d_printer': ['FDM', 'SLA', 'Metal', '3D Pen', 'Others'],
        'filament': ['ABS', 'PETG', 'PLA', 'Carbon Fiber', 'Nylon Fiber', 'Others'],
        'resin': ['Standard', 'Water-Washable', 'Tough', 'Others'],
        // others have no sub-cats or just "Standard"
    };

    interface Product {
        id: string;
        name: string;
        description: string;
        price: number;
        stock: number;
        image_url: string | null;
        category: string;
        specifications?: Record<string, string>; // ✅ NEW: Dictionary for specs
        totalSales?: number;
        short_description?: string;
        sub_category?: string;
        product_images?: Array<{
            id: string;
            image_url?: string;
            image_data?: string;
            display_order: number;
        }>;
    }

    interface AdminOrderItemProduct {
        id: string;
        name: string;
        price: number;
        image_url?: string | null;
    }

    interface AdminOrderItem {
        product_id: string | null;
        quantity: number;
        line_total: number;
        product?: AdminOrderItemProduct | null;
    }

    interface ShippingAddress {
        fullName?: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        state?: string;
        pincode?: string;
        notes?: string;
    }

    interface Order {
        id: string;
        total_amount: number;
        status: string;
        created_at: string;
        total_quantity: number;
        user_id: string;
        items: AdminOrderItem[];
        shipping_address?: ShippingAddress | null;
        payment_gateway?: string | null;
        user_email?: string | null;
        user_name?: string | null;
    }

    interface SpecItem { key: string; value: string; } // Helper for form handling


    const STATUSOPTIONS = [
        { value: 'pending', label: 'Pending' },
        { value: 'pending_payment', label: 'Pending Payment' },
        { value: 'processing', label: 'Processing' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
    ];

    const STATUSCOLORS: Record<string, string> = {
        pending: 'bg-gray-500',
        pending_payment: 'bg-yellow-500',
        processing: 'bg-blue-500',
        shipped: 'bg-purple-500',
        delivered: 'bg-green-500',
        completed: 'bg-green-600',
        cancelled: 'bg-red-500',
    };

    const STATUSLABELS: Record<string, string> = {
        pending: 'Pending',
        pending_payment: 'Pending Payment',
        processing: 'Processing',
        shipped: 'Shipped',
        delivered: 'Delivered',
        completed: 'Completed',
        cancelled: 'Cancelled',
    };

    // Form state types
    interface ProductFormState {
        name: string;
        description: string;
        short_description: string;
        price: string;
        stock: string;
        category: string;
        sub_category: string;
        imageFiles: File[];
        specs: SpecItem[]; // ✅ NEW: Array for UI handling
    }

    // Track which images to DELETE
    interface EditingProductImageState {
        id: string;
        url: string;
        isNew: boolean;
    }

    export default function AdminDashboard() {
        const navigate = useNavigate();

        const [isAdmin, setIsAdmin] = useState(false);
        const [isLoading, setIsLoading] = useState(true);
        const [products, setProducts] = useState<Product[]>([]);
        const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
        const [orders, setOrders] = useState<Order[]>([]);
        const [showAddProduct, setShowAddProduct] = useState(false);
        const [editingProductImages, setEditingProductImages] = useState<EditingProductImageState[]>([]);
        const [expandedAdminOrderId, setExpandedAdminOrderId] = useState<string | null>(null);

        // Filters State
        const [searchTerm, setSearchTerm] = useState('');
        const [filterCategory, setFilterCategory] = useState('all');
        const [filterSubCategory, setFilterSubCategory] = useState('all'); // ✅ NEW

        // Order Filter State
        const [orderDateFilter, setOrderDateFilter] = useState('all');
        const [orderStartDate, setOrderStartDate] = useState('');
        const [orderEndDate, setOrderEndDate] = useState('');

        // Form State
        const [newProduct, setNewProduct] = useState<ProductFormState>({
            name: '', description: '', short_description: '', price: '', stock: '', category: '3d_printer', sub_category:'', imageFiles: [], specs:[]
        });

        const [newProductImagePreviews, setNewProductImagePreviews] = useState<string[]>([]);

        // Edit product form state
        const [editingProductId, setEditingProductId] = useState<string | null>(null);
        const [editingProductData, setEditingProductData] = useState<ProductFormState>({
            name: '', description: '', short_description: '', price: '', stock: '', category: '3d_printer', sub_category: '', imageFiles: [], specs:[]
        });
        const [editingProductImagePreviews, setEditingProductImagePreviews] = useState<string[]>([]);

        // Order states
        const [updatingOrder, setUpdatingOrder] = useState(false);
        const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

        useEffect(() => {
            checkAdminAccess();
        }, []);

        useEffect(() => {
            return () => {
                newProductImagePreviews.forEach(url => URL.revokeObjectURL(url));
                editingProductImagePreviews.forEach(url => URL.revokeObjectURL(url));
            };
        }, []);

        // ✅ Reset sub-category when main category changes
        useEffect(() => {
            setFilterSubCategory('all');
        }, [filterCategory]);

        // ✅ FILTER LOGIC
        useEffect(() => {
            let result = [...products];

            // Search
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                result = result.filter(p =>
                    p.name.toLowerCase().includes(lower) ||
                    p.category.toLowerCase().includes(lower) ||
                    (p.sub_category || '').toLowerCase().includes(lower)
                );
            }

            // Category Filter
            if (filterCategory !== 'all') {
                result = result.filter(p => p.category === filterCategory);
            }

            // Sub-Category Filter
            if (filterSubCategory !== 'all') {
                result = result.filter(p => p.sub_category === filterSubCategory);
            }

            setDisplayedProducts(result);
        }, [products, searchTerm, filterCategory, filterSubCategory]);

        const checkAdminAccess = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    toast.error('Please sign in as admin.');
                    navigate('/auth');
                    return;
                }

                const res = await apiService.getCurrentUser();
                const role = res.role || res.user?.role;

                if (role !== 'admin') {
                    toast.error('Access denied. Admin privileges required.');
                    navigate('/');
                    return;
                }

                setIsAdmin(true);
                await fetchDashboardData();
            } catch (error: any) {
                console.error('Admin access check failed:', error);
                toast.error('Session expired. Please sign in again.');
                navigate('/auth');
            } finally {
                setIsLoading(false);
            }
        };

        const fetchDashboardData = async () => {
            try {
                const productsRes = await apiService.getProducts();
                const rawProducts: any = productsRes.data ?? productsRes;

                const ordersRes = await apiService.getAdminOrders();
                const rawOrders: any = ordersRes.data ?? ordersRes;

                const productsWithSales: Product[] = rawProducts.map(
                    (p: any) => ({
                        ...p,
                        totalSales: (p.totalSales as number) ?? 0,
                    })
                );

                setProducts(productsWithSales);
                setOrders(rawOrders as Order[]);
            } catch (error: any) {
                console.error('Dashboard fetch error:', error);
                toast.error('Failed to load dashboard data');
            }
        };

        // ============ SPECIFICATION HANDLERS ============

        const addSpecField = (isEditing: boolean) => {
            const setter = isEditing ? setEditingProductData : setNewProduct;
            setter(prev => ({
                ...prev,
                specs: [...prev.specs, { key: '', value: '' }]
            }));
        };

        const removeSpecField = (isEditing: boolean, index: number) => {
            const setter = isEditing ? setEditingProductData : setNewProduct;
            setter(prev => ({
                ...prev,
                specs: prev.specs.filter((_, i) => i !== index)
            }));
        };

        const updateSpecField = (isEditing: boolean, index: number, field: 'key' | 'value', value: string) => {
            const setter = isEditing ? setEditingProductData : setNewProduct;
            setter(prev => {
                const newSpecs = [...prev.specs];
                newSpecs[index][field] = value;
                return { ...prev, specs: newSpecs };
            });
        };


        // ============ ADD PRODUCT HANDLERS ============

        const handleNewProductImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || []);
            const totalImages = newProduct.imageFiles.length + files.length;

            if (totalImages > 7) {
                toast.error(`Maximum 7 images allowed. Current: ${newProduct.imageFiles.length}`);
                return;
            }

            const previews: string[] = [];
            files.forEach(file => {
                const url = URL.createObjectURL(file);
                previews.push(url);
            });

            setNewProductImagePreviews(prev => [...prev, ...previews]);
            setNewProduct(prev => ({
                ...prev,
                imageFiles: [...prev.imageFiles, ...files],
            }));
        };

        const removeNewProductImage = (index: number) => {
            const url = newProductImagePreviews[index];
            if (url) URL.revokeObjectURL(url);

            setNewProductImagePreviews(prev => prev.filter((_, i) => i !== index));
            setNewProduct(prev => ({
                ...prev,
                imageFiles: prev.imageFiles.filter((_, i) => i !== index),
            }));
        };

        const handleAddProduct = async (e: React.FormEvent) => {
            e.preventDefault();
            try {
                // Convert Array Specs to Object
                const specsObject = newProduct.specs.reduce((acc, item) => {
                    if (item.key.trim() && item.value.trim()) acc[item.key] = item.value;
                    return acc;
                }, {} as Record<string, string>);

                const formData = new FormData();
                formData.append('name', newProduct.name);
                formData.append('description', newProduct.description || '');
                formData.append('short_description', newProduct.short_description || '');
                formData.append('price', newProduct.price);
                formData.append('stock', newProduct.stock);
                formData.append('category', newProduct.category);
                formData.append('sub_category', newProduct.sub_category || '');
                formData.append('specifications', JSON.stringify(specsObject)); // ✅ Send as JSON string

                newProduct.imageFiles.forEach(f => formData.append('images', f));

                await apiService.createProduct(formData);
                toast.success('Product added successfully!');
                setShowAddProduct(false);
                setNewProduct({ name: '', description: '', short_description: '', price: '', stock: '', category: '3d_printer', sub_category:'', imageFiles: [], specs: [] });
                setNewProductImagePreviews([]);
                await fetchDashboardData();
            } catch (e: any) { toast.error(e.message || 'Error adding product'); }
        };

        // ============ EDIT PRODUCT HANDLERS ============

        const startEditProduct = (p: Product) => {
            setEditingProductId(p.id);

            // Convert Object Specs to Array for UI
            const specsArray = p.specifications
                ? Object.entries(p.specifications).map(([key, value]) => ({ key, value }))
                : [];

            setEditingProductData({
                name: p.name,
                description: p.description || '',
                short_description: p.short_description || '',
                price: String(p.price),
                stock: String(p.stock),
                category: p.category,
                sub_category: p.sub_category || '',
                imageFiles: [],
                specs: specsArray // ✅ Load specs
            });

            const imgs = (p.product_images || []).sort((a,b) => a.display_order - b.display_order)
                .map(i => ({ id: i.id, url: i.image_url || i.image_data || '', isNew: false }))
                .filter(i => i.url);
            setEditingProductImages(imgs);
        };

        const cancelEditProduct = () => {
            editingProductImages.forEach(img => {
                if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
            });

            setEditingProductId(null);
            setEditingProductData({
                name: '',
                description: '',
                short_description: '',
                price: '',
                stock: '',
                category: '3d_printer',
                sub_category: '',
                imageFiles: [],
                specs: [] as { key: string; value: string }[]
        });
            setEditingProductImages([]);
        };

        const handleEditProductImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || []);
            const totalImages = editingProductImages.length + files.length;

            if (totalImages > 7) {
                toast.error(`Maximum 7 images. Current: ${editingProductImages.length}`);
                return;
            }

            const newImages: EditingProductImageState[] = files.map(file => ({
                id: `new-${Date.now()}-${Math.random()}`,
                url: URL.createObjectURL(file),
                isNew: true,
            }));

            setEditingProductImages(prev => [...prev, ...newImages]);
            setEditingProductData(prev => ({
                ...prev,
                imageFiles: [...prev.imageFiles, ...files],
            }));
        };

        const removeEditProductImage = (index: number) => {
            const image = editingProductImages[index];

            if (image.url.startsWith('blob:')) {
                URL.revokeObjectURL(image.url);
            }

            setEditingProductImages(prev => prev.filter((_, i) => i !== index));

            if (image.isNew) {
                const newFileIndex = editingProductImages
                    .slice(0, index)
                    .filter(img => img.isNew).length;

                setEditingProductData(prev => ({
                    ...prev,
                    imageFiles: prev.imageFiles.filter((_, i) => i !== newFileIndex),
                }));
            }
        };

        const saveEditedProduct = async () => {
            try {
                if (!editingProductId) return;



                // Convert Array Specs to Object
                const specsObject = editingProductData.specs.reduce((acc, item) => {
                    if (item.key.trim() && item.value.trim()) acc[item.key] = item.value;
                    return acc;
                }, {} as Record<string, string>);


                const formData = new FormData();
                formData.append('name', editingProductData.name);
                formData.append('description', editingProductData.description || '');
                formData.append('short_description', editingProductData.short_description || '');
                formData.append('price', editingProductData.price);
                formData.append('stock', editingProductData.stock);
                formData.append('category', editingProductData.category);
                formData.append('sub_category', editingProductData.sub_category || '');
                formData.append('specifications', JSON.stringify(specsObject)); // ✅ Send as JSON string


                const imagesToDelete = products
                    .find(p => p.id === editingProductId)
                    ?.product_images?.filter(
                        img => !editingProductImages.some(ei => ei.id === img.id)
                    )
                    .map(img => img.id) || [];

                if (imagesToDelete.length > 0) {
                    formData.append('imagesToDelete', JSON.stringify(imagesToDelete));
                }

                editingProductData.imageFiles.forEach(file => {
                    formData.append('images', file);
                });

                await apiService.updateProduct(editingProductId, formData);
                toast.success('Product updated successfully!');
                setEditingProductId(null); // Close edit
                cancelEditProduct();
                await fetchDashboardData();
            } catch (error: any) {
                console.error('Update product error:', error);
                toast.error(error.message || 'Failed to update product');
            }
        };

        // ============ ORDER HANDLERS ============

        const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
            try {
                setUpdatingOrder(true);
                await apiService.updateOrderStatus(orderId, newStatus);

                setOrders(prev =>
                    prev.map(order =>
                        order.id === orderId ? { ...order, status: newStatus } : order
                    )
                );

                const label = STATUSOPTIONS.find(s => s.value === newStatus)?.label;
                toast.success(`Order status updated to ${label || newStatus}`);
            } catch (error: any) {
                console.error('Update order status error:', error);
                toast.error(error.message || 'Failed to update order status');
            } finally {
                setUpdatingOrder(false);
            }
        };

        const getFilteredOrders = () => {
            if (orderDateFilter === 'all') return orders;

            const now = new Date();

            return orders.filter(order => {
                const orderDate = new Date(order.created_at);

                switch (orderDateFilter) {
                    case 'last_day':
                        return orderDate.getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
                    case 'last_week':
                        return orderDate.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
                    case 'last_month':
                        return orderDate.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
                    case 'last_year':
                        return orderDate.getTime() >= now.getTime() - 365 * 24 * 60 * 60 * 1000;
                    case 'date':
                        if (!orderStartDate) return true;
                        const selected = new Date(orderStartDate);
                        return orderDate.getFullYear() === selected.getFullYear() &&
                            orderDate.getMonth() === selected.getMonth() &&
                            orderDate.getDate() === selected.getDate();
                    case 'range':
                        if (!orderStartDate || !orderEndDate) return true;
                        const start = new Date(orderStartDate);
                        const end = new Date(orderEndDate);
                        end.setHours(23, 59, 59, 999);
                        return orderDate >= start && orderDate <= end;
                    default:
                        return true;
                }
            });
        };

        const filteredOrders = getFilteredOrders();

        // Helper for rendering Spec Inputs
        const renderSpecInputs = (isEditing: boolean, specs: SpecItem[]) => (
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <Label>Specifications</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => addSpecField(isEditing)}>
                        <Plus className="w-3 h-3 mr-1" /> Add Spec
                    </Button>
                </div>
                {specs.map((spec, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <Input
                            placeholder="Key (e.g. Weight)"
                            value={spec.key}
                            onChange={(e) => updateSpecField(isEditing, index, 'key', e.target.value)}
                            className="flex-1"
                        />
                        <span className="text-muted-foreground">:</span>
                        <Input
                            placeholder="Value (e.g. 10kg)"
                            value={spec.value}
                            onChange={(e) => updateSpecField(isEditing, index, 'value', e.target.value)}
                            className="flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSpecField(isEditing, index)} className="text-red-500">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
                {specs.length === 0 && <p className="text-xs text-muted-foreground italic">No specifications added.</p>}
            </div>
        );

        // ============ CALCULATIONS ============

        const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
        const totalOrders = orders.length;
        const totalProducts = products.length;
        const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 5);
        const outOfStockProducts = products.filter(p => p.stock === 0);
        const bestSellingProduct = products.length > 0
            ? products.reduce((prev, current) =>
                (current.totalSales ?? 0) > (prev.totalSales ?? 0) ? current : prev
            ) : undefined;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center pt-20">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            );
        }

        if (!isAdmin) {
            return null;
        }

        return (
            <div className="min-h-screen pt-20 pb-10">
                <div className="container mx-auto px-4">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="font-display text-4xl mb-2">Admin Dashboard</h1>
                        <p className="text-muted-foreground">Monitor sales and manage products</p>
                    </div>

                    {/* Inventory Alerts */}
                    {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
                        <div className="mb-6">
                            <Card className="border-orange-500 bg-orange-50/10">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                        <CardTitle className="text-orange-500 text-base">Inventory Alerts</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {outOfStockProducts.length > 0 && (
                                            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-100">
                                                <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
                                                    Out of Stock ({outOfStockProducts.length})
                                                </p>
                                                <div className="mt-1 space-y-1">
                                                    {outOfStockProducts.map(p => (
                                                        <p key={p.id} className="text-xs text-red-600 dark:text-red-400 truncate">
                                                            • {p.name}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {lowStockProducts.length > 0 && (
                                            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-100">
                                                <p className="font-semibold text-orange-700 dark:text-orange-400 text-sm">
                                                    Low Stock ({lowStockProducts.length})
                                                </p>
                                                <div className="mt-1 space-y-1">
                                                    {lowStockProducts.map(p => (
                                                        <p key={p.id} className="text-xs text-orange-600 dark:text-orange-400 truncate">
                                                            • {p.name} - {p.stock} left
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatINR(totalRevenue)}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalOrders}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Products</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalProducts}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatINR(avgOrderValue)}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Products Section */}
                    <Card className="mb-8">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Inventory ({totalProducts})</CardTitle>
                                    <CardDescription>Manage products and stock</CardDescription>
                                </div>
                                <Button onClick={() => setShowAddProduct(!showAddProduct)} size="sm">
                                    <Plus className="mr-2 h-4 w-4" /> Add Product
                                </Button>
                            </div>
                        </CardHeader>

                        {/* FILTER BAR FOR PRODUCTS */}
                            <div className="px-6 pb-4 flex flex-col sm:flex-row gap-4 border-b">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search products..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {MAIN_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                {/* SUB-CATEGORY FILTER */}
                                {filterCategory !== 'all' && SUB_CATEGORIES[filterCategory] && (
                                    <Select value={filterSubCategory} onValueChange={setFilterSubCategory}>
                                        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sub-Category" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            {SUB_CATEGORIES[filterCategory].map(sc => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                        <CardContent className="pt-6">

                            {/* ADD PRODUCT FORM */}
                            {showAddProduct && (
                                <div className="mb-8 p-6 border rounded-xl bg-secondary/10">
                                    <h3 className="font-bold mb-4 text-lg">Add New Product</h3>
                                    <form onSubmit={handleAddProduct} className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div><Label>Name</Label><Input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required /></div>
                                            <div><Label>Price</Label><Input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required /></div>
                                            <div><Label>Stock</Label><Input type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} required /></div>

                                            {/* CATEGORIES */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Label>Category</Label>
                                                    <Select value={newProduct.category} onValueChange={val => setNewProduct({...newProduct, category: val, sub_category: ''})}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>{MAIN_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Sub Category</Label>
                                                    <Select value={newProduct.sub_category} onValueChange={val => setNewProduct({...newProduct, sub_category: val})} disabled={!SUB_CATEGORIES[newProduct.category]}>
                                                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                                                        <SelectContent>{SUB_CATEGORIES[newProduct.category]?.map(sc => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        <div><Label>Short Description (List View)</Label><Textarea value={newProduct.short_description} onChange={e => setNewProduct({...newProduct, short_description: e.target.value})} maxLength={150} /></div>
                                        {renderSpecInputs(false, newProduct.specs)}
                                        <div>
                                            <Label>Full Description</Label>
                                            <Textarea
                                                className="h-32"
                                                value={newProduct.description}
                                                placeholder="To start a new paragraph, leave an empty line instead of pressing Enter for a single line break."
                                                onChange={e =>
                                                    setNewProduct({ ...newProduct, description: e.target.value })
                                                }
                                            />
                                        </div>

                                        {/* IMAGES */}
                                        <div>
                                            <Label>Images ({newProductImagePreviews.length}/7)</Label>
                                            <div className="mt-2 grid grid-cols-4 gap-2">
                                                {newProductImagePreviews.map((url, i) => (
                                                    <div key={i} className="relative group aspect-square">
                                                        <img src={url} className="w-full h-full object-cover rounded-md border" />
                                                        <button type="button" onClick={() => removeNewProductImage(i)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button>
                                                    </div>
                                                ))}
                                                <label className="border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 aspect-square">
                                                    <Upload className="h-6 w-6 text-muted-foreground" /><input type="file" multiple accept="image/*" className="hidden" onChange={handleNewProductImagesUpload} />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            <Button type="submit">Create</Button>
                                            <Button type="button" variant="ghost" onClick={() => setShowAddProduct(false)}>Cancel</Button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* PRODUCTS LIST */}
                            <div className="space-y-4">
                                {displayedProducts.map(product => (
                                    <div key={product.id} className="p-4 border rounded-lg hover:bg-muted/5 transition-colors">
                                        {editingProductId === product.id ? (
                                            // EDIT MODE
                                            <div className="space-y-4">
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <div><Label>Name</Label><Input value={editingProductData.name} onChange={e => setEditingProductData({...editingProductData, name: e.target.value})} /></div>
                                                    <div><Label>Price</Label><Input type="number" value={editingProductData.price} onChange={e => setEditingProductData({...editingProductData, price: e.target.value})} /></div>
                                                    <div><Label>Stock</Label><Input type="number" value={editingProductData.stock} onChange={e => setEditingProductData({...editingProductData, stock: e.target.value})} /></div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div><Label>Category</Label><Select value={editingProductData.category} onValueChange={v => setEditingProductData({...editingProductData, category: v, sub_category: ''})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAIN_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
                                                        <div><Label>Sub Category</Label><Select value={editingProductData.sub_category} onValueChange={v => setEditingProductData({...editingProductData, sub_category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUB_CATEGORIES[editingProductData.category]?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                                    </div>
                                                </div>
                                                <div><Label>Short Desc</Label><Textarea value={editingProductData.short_description} onChange={e => setEditingProductData({...editingProductData, short_description: e.target.value})} /></div>
                                                {renderSpecInputs(true, editingProductData.specs)}
                                                <div>
                                                    <Label>Full Description</Label>
                                                    <Textarea
                                                        className="h-32"
                                                        value={newProduct.description}
                                                        placeholder="To start a new paragraph, leave an empty line instead of pressing Enter for a single line break."
                                                        onChange={e =>
                                                            setNewProduct({ ...newProduct, description: e.target.value })
                                                        }
                                                    />
                                                </div>

                                                {/* Edit Images */}
                                                <div>
                                                    <Label>Images</Label>
                                                    <div className="mt-2 grid grid-cols-5 gap-2">
                                                        {editingProductImages.map((img, i) => (
                                                            <div key={img.id} className="relative group aspect-square">
                                                                <img src={img.url} className="w-full h-full object-cover rounded border" />
                                                                <button onClick={() => removeEditProductImage(i)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button>
                                                            </div>
                                                        ))}
                                                        <label className="border-dashed border-2 rounded flex items-center justify-center cursor-pointer aspect-square"><Plus/><input type="file" multiple hidden onChange={handleEditProductImagesUpload}/></label>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Button onClick={saveEditedProduct} size="sm">Save</Button>
                                                    <Button variant="ghost" onClick={cancelEditProduct} size="sm">Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            // VIEW MODE
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                <div className="flex gap-4 items-start flex-1">
                                                    {/* Single Large Image */}
                                                    <div className="h-24 w-24 bg-white rounded-md overflow-hidden shrink-0 border p-1">
                                                        <img
                                                            src={product.image_url || "/placeholder.svg"}
                                                            alt={product.name}
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-lg">{product.name}</span>
                                                            <Badge variant="secondary">{product.category.replace(/_/g, ' ')}</Badge>
                                                            {product.sub_category && <Badge variant="outline">{product.sub_category}</Badge>}
                                                        </div>

                                                        {/* Short Description */}
                                                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl">
                                                            {product.short_description|| product.description || "No short description"}
                                                        </p>

                                                        {/* Stock Alert */}
                                                        {product.stock < 5 && (
                                                            <div className={`text-xs font-medium flex items-center gap-1 ${product.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                                                <AlertTriangle size={12} />
                                                                {product.stock === 0 ? "Out of Stock" : `Low Stock: ${product.stock}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right flex flex-col items-end gap-1 min-w-[100px]">
                                                    <span className="font-bold text-xl">{formatINR(product.price)}</span>
                                                    <span className="text-sm text-muted-foreground">Stock: {product.stock}</span>
                                                    <Button variant="outline" size="sm" onClick={() => startEditProduct(product)} className="mt-2 w-full">
                                                        <Edit3 size={14} className="mr-2"/> Edit
                                                    </Button>
                                                </div>
                                            </div>

                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ORDERS SECTION */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                            <div>
                                <CardTitle>Recent Orders</CardTitle>
                                <CardDescription>View and manage customer orders</CardDescription>
                            </div>

                            {/* ORDER FILTERS */}
                            <div className="flex items-center gap-2">
                                <Select value={orderDateFilter} onValueChange={setOrderDateFilter}>
                                    <SelectTrigger className="w-[150px]"><CalendarIcon className="mr-2 h-4 w-4" /><SelectValue placeholder="Date Filter" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="last_day">Last 24 Hours</SelectItem>
                                        <SelectItem value="last_week">Last 7 Days</SelectItem>
                                        <SelectItem value="last_month">Last 30 Days</SelectItem>
                                        <SelectItem value="last_year">Last Year</SelectItem>
                                        <SelectItem value="date">Specific Date</SelectItem>
                                        <SelectItem value="range">Date Range</SelectItem>
                                    </SelectContent>
                                </Select>

                                {orderDateFilter === 'date' && <Input type="date" className="w-[150px]" value={orderStartDate} onChange={e => setOrderStartDate(e.target.value)} />}
                                {orderDateFilter === 'range' && (
                                    <div className="flex items-center gap-2">
                                        <Input type="date" className="w-[140px]" value={orderStartDate} onChange={e => setOrderStartDate(e.target.value)} />
                                        <span>-</span>
                                        <Input type="date" className="w-[140px]" value={orderEndDate} onChange={e => setOrderEndDate(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="pt-6">
                            {filteredOrders.length === 0 ? <p className="text-center text-muted-foreground py-8">No orders found matching filters</p> : (
                                <div className="space-y-4">
                                    {filteredOrders.map(order => (
                                        <Card key={order.id} className="p-6 hover:bg-muted/5 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-4 mb-3">
                                                        <h3 className="text-lg font-semibold">Order {order.id.slice(0, 8)}</h3>
                                                        <Badge className={`${STATUSCOLORS[order.status]} text-white`}>{STATUSLABELS[order.status]}</Badge>
                                                    </div>
                                                    <div className="grid sm:grid-cols-5 gap-4 text-sm mb-4">
                                                        <div><p className="text-muted-foreground">ID</p><p className="font-medium">{order.id.slice(0,8)}</p></div>
                                                        <div><p className="text-muted-foreground">Date</p><p className="font-medium">{new Date(order.created_at).toLocaleDateString()}</p></div>
                                                        <div><p className="text-muted-foreground">Items</p><p className="font-medium">{order.total_quantity}</p></div>
                                                        <div><p className="text-muted-foreground">Total</p><p className="font-bold text-primary">{formatINR(order.total_amount)}</p></div>
                                                        <div>
                                                            <p className="text-muted-foreground">Status</p>
                                                            <select value={order.status} onChange={e => handleUpdateOrderStatus(order.id, e.target.value)} disabled={updatingOrder} className="border rounded px-2 py-1 text-sm w-full bg-background">
                                                                {STATUSOPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => setExpandedAdminOrderId(expandedAdminOrderId === order.id ? null : order.id)}>
                                                    <ChevronRight className={`w-5 h-5 transition-transform ${expandedAdminOrderId === order.id ? 'rotate-90' : ''}`} />
                                                </Button>
                                            </div>
                                            {/* EXPANDED ORDER DETAILS (Customer, Address, Items) */}
                                            {expandedAdminOrderId === order.id && (
                                                <div className="mt-4 border-t pt-4 space-y-4 text-sm">
                                                    <div className="grid md:grid-cols-2 gap-6">
                                                        <div>
                                                            <h4 className="font-semibold mb-2">Customer</h4>
                                                            <div className="bg-muted p-3 rounded space-y-1">
                                                                <p className="font-medium">{order.shipping_address?.fullName || order.user_name || 'N/A'}</p>
                                                                <p className="text-xs text-muted-foreground">{order.shipping_address?.email || order.user_email}</p>
                                                                <p className="text-xs text-muted-foreground">{order.shipping_address?.phone}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-2">Shipping</h4>
                                                            <div className="bg-muted p-3 rounded space-y-1">
                                                                <p>{order.shipping_address?.address}</p>
                                                                <p className="text-xs">{[order.shipping_address?.city, order.shipping_address?.state, order.shipping_address?.pincode].filter(Boolean).join(', ')}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold mb-2">Items</h4>
                                                        <div className="space-y-2">
                                                            {order.items?.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between p-3 bg-muted rounded items-center">
                                                                    <div>
                                                                        <p className="font-medium">{item.product?.name || 'Unknown'}</p>
                                                                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                                                    </div>
                                                                    <p className="font-semibold">{formatINR(item.line_total || 0)}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
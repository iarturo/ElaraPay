export interface Product {
    id: string;
    name: string;
    description: string;
    price: string;
    image: string;
    badge?: 'new' | 'bestseller' | 'limited';
    sizes: string[];
    colors: string[];
}

export const PRODUCTS: Product[] = [
    {
        id: 'ORD-1001',
        name: 'Abstract Muse Tee',
        description: 'Minimalist abstract art on premium cotton. A wearable piece of art for the creative soul.',
        price: '25',
        image: '/products/tshirt-white-abstract.png',
        badge: 'bestseller',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['#FFFFFF', '#F5F5F5', '#FDE8E8'],
    },
    {
        id: 'ORD-1002',
        name: 'Noir & Gold Edition',
        description: 'Elegant gold geometric patterns on deep black. For nights that demand attention.',
        price: '35',
        image: '/products/tshirt-black-gold.png',
        badge: 'limited',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: ['#1A1A1A', '#2D2D2D'],
    },
    {
        id: 'ORD-1003',
        name: 'Sage Oversized Tee',
        description: 'Relaxed oversized fit in calming sage green. Comfort meets effortless style.',
        price: '22',
        image: '/products/tshirt-sage-green.png',
        badge: 'new',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['#9CAF88', '#B4C7A5', '#E8F0E3'],
    },
    {
        id: 'ORD-1004',
        name: 'Rose Garden Tee',
        description: 'Dusty rose with delicate floral embroidery. Romantic details meet modern silhouette.',
        price: '28',
        image: '/products/tshirt-dusty-rose.png',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['#D4A0A0', '#E8C4C4', '#F5E1E1'],
    },
    {
        id: 'ORD-1005',
        name: 'Lavender Crop',
        description: 'Trendy cropped silhouette in soft lavender. Perfect for high-waist pairings.',
        price: '20',
        image: '/products/tshirt-lavender.png',
        badge: 'new',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: ['#C4B5E0', '#D8CCF0', '#E8E0F5'],
    },
    {
        id: 'ORD-1006',
        name: 'Maritime Stripe Tee',
        description: 'Classic navy with crisp white sleeve stripes. Timeless nautical elegance reimagined.',
        price: '1',
        image: '/products/tshirt-navy-stripe.png',
        badge: 'bestseller',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['#1E3A5F', '#2C4F7C', '#FFFFFF'],
    },
];

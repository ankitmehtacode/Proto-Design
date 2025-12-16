import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductImage {
    id: string;
    image_url?: string;
    image_data?: string;
    display_order: number;
}

interface ProductImageCarouselProps {
    images: ProductImage[];
    productName: string;
}

const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({
                                                                       images,
                                                                       productName,
                                                                   }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const validImages = images.filter(img =>
        img.image_url || img.image_data
    );

    // Fallback if no images
    if (validImages.length === 0) {
        return (
            <div className="w-full h-64 bg-muted/20 rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No images</span>
            </div>
        );
    }

    const getImageUrl = (img: ProductImage): string => {
        if (img.image_url) return img.image_url;
        if (img.image_data) return img.image_data;
        return '/placeholder.svg';
    };

    const handleNext = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % validImages.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    };

    return (
        <div className="relative w-full h-64 group bg-white rounded-lg overflow-hidden">
            <img
                src={getImageUrl(validImages[currentIndex])}
                alt={`${productName} - View ${currentIndex + 1}`}
                className="w-full h-full object-contain p-2 transition-transform duration-500"
                loading="lazy"
                onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
            />

            {validImages.length > 1 && (
                <>
                    {/* Navigation Arrows */}
                    <button
                        onClick={handlePrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 z-20 backdrop-blur-sm"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 z-20 backdrop-blur-sm"
                        aria-label="Next image"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>

                    {/* Dots Indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 p-1 rounded-full bg-black/20 backdrop-blur-[1px]">
                        {validImages.map((_, index) => (
                            <button
                                key={index}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCurrentIndex(index);
                                }}
                                className={`w-1.5 h-1.5 rounded-full transition-all shadow-sm ${
                                    index === currentIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                                }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductImageCarousel;
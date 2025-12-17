import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STLViewer } from "@/components/STLViewer";
import { useDropzone } from "react-dropzone";
import { Upload, Check, Loader2, FileBox, Ruler, Clock, RotateCw, Scale, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/services/api.service";
import { formatINR } from "@/lib/currency";

// --- OPTIONS CONSTANTS ---
const PRINTER_QUALITIES = [
    { id: "0.2-std-0.6-nozzle", name: "0.2 mm Standard (0.6mm Nozzle)", multiplier: 1.0 },
    { id: "0.2-std", name: "0.2 mm Standard", multiplier: 1.2 },
    { id: "0.15-med", name: "0.15 mm Medium", multiplier: 1.5 },
    { id: "0.1-high", name: "0.1 mm High Detail", multiplier: 2.0 },
];

const MATERIALS = [
    { id: "abs", name: "ABS", colors: ["Black", "White", "Grey", "Red", "Blue"] },
    { id: "pla", name: "PLA", colors: ["Black", "White", "Grey", "Yellow", "Green"] },
    { id: "petg", name: "PETG", colors: ["Translucent", "Black"] },
];

const INFILLS = [20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function CustomPrinting() {
    // --- STATE ---
    const [file, setFile] = useState<File | null>(null);
    const [rotation, setRotation] = useState({ x: 0, y: 0 });

    const [modelStats, setModelStats] = useState({
        volume: 0,
        dimensions: { x: 0, y: 0, z: 0 }
    });

    const [scale, setScale] = useState(1);

    // Selections
    const [quality, setQuality] = useState(PRINTER_QUALITIES[0]);
    const [material, setMaterial] = useState(MATERIALS[0]);
    const [color, setColor] = useState(MATERIALS[0].colors[0]);
    const [infill, setInfill] = useState(20);

    const [contact, setContact] = useState({ email: "", phone: "", notes: "" });
    const [isSending, setIsSending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // --- ACTIONS ---

    // ✅ NEW: Handle File Removal
    const handleRemoveFile = () => {
        setFile(null);
        setRotation({ x: 0, y: 0 });
        setScale(1);
        setModelStats({ volume: 0, dimensions: { x: 0, y: 0, z: 0 } });
        toast.info("Model removed");
    };

    const handleSendQuote = async () => {
        if (!contact.email || !contact.phone) {
            toast.error("Please enter email and phone number");
            return;
        }
        setIsSending(true);

        const formData = new FormData();
        if (file) formData.append("file", file);
        formData.append("email", contact.email);
        formData.append("phone", contact.phone);
        formData.append("notes", contact.notes);

        const specs = JSON.stringify({
            quality: quality.name,
            material: `${material.name} - ${color}`,
            infill: `${infill}%`,
            originalStats: modelStats,
            printDimensions: printDims,
            scale: `${(scale * 100).toFixed(0)}%`,
            estimatedPrice: calculatePrice(),
            estimatedTime: calculateTime()
        });
        formData.append("specifications", specs);

        try {
            await apiService.sendQuoteRequest(formData);
            toast.success("Quote sent successfully!");
            setIsSuccess(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to send quote. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    // --- LOGIC: DIMENSION SCALING ---

    useEffect(() => {
        setScale(1);
    }, [file]);

    const printDims = {
        x: parseFloat((modelStats.dimensions.x * scale).toFixed(2)),
        y: parseFloat((modelStats.dimensions.y * scale).toFixed(2)),
        z: parseFloat((modelStats.dimensions.z * scale).toFixed(2)),
    };

    const handleDimensionChange = (axis: 'x' | 'y' | 'z', value: string) => {
        const val = parseFloat(value);
        if (isNaN(val) || val <= 0) return;
        const originalDim = modelStats.dimensions[axis];
        if (originalDim > 0) {
            setScale(val / originalDim);
        }
    };

    // --- LOGIC: PRICING ---
    const calculatePrice = () => {
        if (!modelStats.volume) return 0;
        const scaledVolume = modelStats.volume * Math.pow(scale, 3);
        const baseRate = 8;
        const infillFactor = 1 + (infill / 200);
        return Math.round(scaledVolume * baseRate * quality.multiplier * infillFactor) + 150;
    };

    const calculateTime = () => {
        if (!modelStats.volume) return "0h 0m";
        const scaledVolume = modelStats.volume * Math.pow(scale, 3);
        const hours = (scaledVolume / 10) * quality.multiplier * (1 + infill/100);
        const h = Math.floor(hours);
        const m = Math.floor((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    const onDrop = useCallback((files: File[]) => {
        if(files.length) setFile(files[0]);
    }, []);
    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: {'model/stl':['.stl'], 'model/obj':['.obj']},
        maxFiles: 1,
        disabled: !!file // Disable dropzone if file exists
    });

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-20">
                <div className="text-center max-w-md p-8">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Request Sent!</h2>
                    <p className="text-muted-foreground mb-8">
                        Our team will verify your file and send the payment link to <strong>{contact.email}</strong> shortly.
                    </p>
                    <Button onClick={() => window.location.reload()}>Submit Another</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 bg-gray-50">
            <div className="container mx-auto px-4">

                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Instant 3D Printing Quote</h1>
                    <p className="text-muted-foreground">Upload your model and customize specifications.</p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT COLUMN: Viewer */}
                    <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-4">
                        <Card className="overflow-hidden border-2 border-dashed border-border/50 shadow-sm">

                            {/* ✅ NEW: File Header Bar */}
                            {file && (
                                <div className="bg-white border-b p-3 flex justify-between items-center px-4">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="bg-blue-100 p-1.5 rounded text-blue-600">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="truncate">
                                            <p className="text-sm font-semibold truncate max-w-[200px]">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{(file.size/1024/1024).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleRemoveFile}
                                        className="h-8 px-3"
                                    >
                                        <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                                    </Button>
                                </div>
                            )}

                            <div className="h-[500px] w-full bg-slate-900 relative">
                                <STLViewer
                                    file={file}
                                    rotationX={rotation.x}
                                    rotationY={rotation.y}
                                    onStatsCalculated={setModelStats}
                                />
                                {!file && (
                                    <div {...getRootProps()} className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20 cursor-pointer hover:bg-black/30 transition text-white">
                                        <input {...getInputProps()} />
                                        <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm mb-4">
                                            <Upload className="w-8 h-8" />
                                        </div>
                                        <p className="font-semibold text-lg">Click or Drop STL/OBJ here</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* Rotation Inputs */}
                        {file && (
                            <div className="flex gap-4 p-4 bg-white rounded-lg border shadow-sm items-center">
                                <RotateCw className="w-5 h-5 text-muted-foreground" />
                                <span className="font-medium text-sm">Orientation:</span>

                                <div className="flex items-center gap-2">
                                    <Label className="text-xs">X Axis</Label>
                                    <Input
                                        type="number"
                                        className="w-20 h-8"
                                        value={rotation.x}
                                        onChange={e => setRotation(p => ({...p, x: Number(e.target.value)}))}
                                    />
                                    <span className="text-sm text-muted-foreground">°</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Label className="text-xs">Y Axis</Label>
                                    <Input
                                        type="number"
                                        className="w-20 h-8"
                                        value={rotation.y}
                                        onChange={e => setRotation(p => ({...p, y: Number(e.target.value)}))}
                                    />
                                    <span className="text-sm text-muted-foreground">°</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Configuration Form */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* (Rest of the code matches the previous Single Page implementation) */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Ruler className="w-5 h-5 text-primary" /> Dimensions & Scale
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg text-sm mb-2">
                                    <div>
                                        <span className="text-muted-foreground block text-xs mb-1">Original Size</span>
                                        <span className="font-mono font-medium">
                                            {modelStats.dimensions.x} x {modelStats.dimensions.y} x {modelStats.dimensions.z} cm
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs mb-1">Material Volume</span>
                                        <span className="font-mono font-medium">
                                            {(modelStats.volume * Math.pow(scale, 3)).toFixed(2)} cm³
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label>Printing Dimensions (cm)</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Input
                                                value={printDims.x}
                                                onChange={e => handleDimensionChange('x', e.target.value)}
                                                placeholder="L"
                                            />
                                            <span className="text-xs text-muted-foreground text-center block mt-1">Length</span>
                                        </div>
                                        <div>
                                            <Input
                                                value={printDims.y}
                                                onChange={e => handleDimensionChange('y', e.target.value)}
                                                placeholder="W"
                                            />
                                            <span className="text-xs text-muted-foreground text-center block mt-1">Width</span>
                                        </div>
                                        <div>
                                            <Input
                                                value={printDims.z}
                                                onChange={e => handleDimensionChange('z', e.target.value)}
                                                placeholder="H"
                                            />
                                            <span className="text-xs text-muted-foreground text-center block mt-1">Height</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex justify-between">
                                        <span>Scale Factor</span>
                                        <span className="text-muted-foreground font-normal">{(scale * 100).toFixed(0)}%</span>
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Scale className="w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={parseFloat(scale.toFixed(2))}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                if (val > 0) setScale(val);
                                            }}
                                            className="w-24"
                                        />
                                        <span className="text-sm font-medium">x Original</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Printer Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <Label>Quality Level</Label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                        value={quality.id}
                                        onChange={e => setQuality(PRINTER_QUALITIES.find(q => q.id === e.target.value) || quality)}
                                    >
                                        {PRINTER_QUALITIES.map(q => (
                                            <option key={q.id} value={q.id}>{q.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Material</Label>
                                        <div className="flex flex-col gap-2">
                                            {MATERIALS.map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => { setMaterial(m); setColor(m.colors[0]); }}
                                                    className={`px-3 py-2 rounded border cursor-pointer text-sm font-medium transition-colors ${material.id === m.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                                                >
                                                    {m.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Color</Label>
                                        <div className="flex flex-col gap-2 h-40 overflow-y-auto pr-1">
                                            {material.colors.map(c => (
                                                <div
                                                    key={c}
                                                    onClick={() => setColor(c)}
                                                    className={`px-3 py-2 rounded border cursor-pointer text-sm transition-colors ${color === c ? 'bg-muted border-foreground' : 'hover:bg-muted/50'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full border shadow-sm`} style={{ backgroundColor: c.toLowerCase() }} />
                                                        {c}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="flex justify-between">
                                        <span>Infill Density</span>
                                        <span className="font-bold text-primary">{infill}%</span>
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {INFILLS.map(i => (
                                            <Button
                                                key={i}
                                                variant={infill === i ? "default" : "outline"}
                                                onClick={() => setInfill(i)}
                                                size="sm"
                                                className="h-8 w-12 p-0"
                                            >
                                                {i}%
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/20 shadow-md">
                            <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-4">
                                <CardTitle className="text-xl flex justify-between items-center">
                                    <span>Estimated Quote</span>
                                    <span className="text-2xl font-bold text-primary">{formatINR(calculatePrice())}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                    <Clock className="w-4 h-4" /> Est. Print Time: {calculateTime()}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input placeholder="Your Email *" value={contact.email} onChange={e => setContact(c => ({...c, email: e.target.value}))} />
                                    <Input placeholder="Phone Number *" value={contact.phone} onChange={e => setContact(c => ({...c, phone: e.target.value}))} />
                                </div>
                                <Textarea placeholder="Special instructions (optional)..." value={contact.notes} onChange={e => setContact(c => ({...c, notes: e.target.value}))} />

                                <Button
                                    className="w-full h-12 text-lg shadow-lg shadow-primary/20"
                                    size="lg"
                                    onClick={handleSendQuote}
                                    disabled={isSending || !file}
                                >
                                    {isSending ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
                                    Send Quote Request
                                </Button>
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </div>
        </div>
    );
}
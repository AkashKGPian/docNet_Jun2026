import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStroke } from 'perfect-freehand';
import { PenTool, Eraser, Trash2, Wand2, CheckSquare, Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import {
  exportDrawingToCanvas,
  preprocessForOcr,
  recognizeHandwritingFromCanvas,
  terminateOcrWorker,
} from '../../utils/canvasOcr';
import './Canvas.css';

// SVG Path helper for perfect-freehand
const getSvgPathFromStroke = (stroke) => {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
};

const Canvas = () => {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const activePointerId = useRef(null);
  const currentPointsRef = useRef([]);
  const isDrawingRef = useRef(false);

  // Freehand State
  const [strokes, setStrokes] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });

  // App State
  const [token, setToken] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [notes, setNotes] = useState('');
  const [manualText, setManualText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch token basics so we know patient info
  useEffect(() => {
    fetchTokenInfo();
  }, [tokenId]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSurfaceSize({ width: Math.round(width), height: Math.round(height) });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => () => {
    terminateOcrWorker();
  }, []);

  const fetchTokenInfo = async () => {
    try {
      const res = await api.get('/queue/active');
      if (res.data?.success) {
        const foundToken = res.data.tokens.find(t => t._id === tokenId);
        if (foundToken) setToken(foundToken);
      }
    } catch (error) {
      toast.error('Could not load patient details.');
    }
  };

  const releasePointer = (target) => {
    if (activePointerId.current !== null && target?.hasPointerCapture?.(activePointerId.current)) {
      target.releasePointerCapture(activePointerId.current);
    }
    activePointerId.current = null;
  };

  // --- Drawing Handlers ---
  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    isDrawingRef.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    const point = [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];
    currentPointsRef.current = [point];
    setCurrentPoints([point]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const point = [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];
    currentPointsRef.current = [...currentPointsRef.current, point];
    setCurrentPoints(currentPointsRef.current);
  };

  const finishStroke = (target) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    releasePointer(target);
    if (currentPointsRef.current.length > 0) {
      setStrokes(prev => [...prev, currentPointsRef.current]);
      currentPointsRef.current = [];
      setCurrentPoints([]);
    }
  };

  const handlePointerUp = (e) => {
    finishStroke(e.currentTarget);
  };

  const handlePointerCancel = (e) => {
    finishStroke(e.currentTarget);
  };

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentPoints([]);
    currentPointsRef.current = [];
  };

  const hasDrawing = strokes.length > 0 || currentPoints.length > 0;

  // --- Handwriting Recognition (client Tesseract.js) ---
  const handleRecognize = async () => {
    if (!hasDrawing && !manualText.trim()) {
      toast.error('Write on the pad or type the medicine row in the text box.');
      return;
    }

    try {
      setProcessing(true);

      if (manualText.trim()) {
        if (hasDrawing) {
          toast('Using typed text — clear the text box to recognize your drawing instead.', {
            id: 'ocr-priority',
            icon: 'ℹ️',
          });
        }
        toast.loading('Parsing medicine row...', { id: 'ocr' });
        const res = await api.post('/canvas/recognize', { text: manualText.trim() });
        addParsedMedicine(res.data, manualText.trim());
        return;
      }

      toast.loading('Loading OCR engine...', { id: 'ocr' });

      const svgElement = containerRef.current?.querySelector('svg');
      const rect = containerRef.current?.getBoundingClientRect();
      const width = surfaceSize.width > 0 ? surfaceSize.width : Math.round(rect?.width || 0);
      const height = surfaceSize.height > 0 ? surfaceSize.height : Math.round(rect?.height || 0);

      if (!width || !height) {
        throw new Error('Drawing pad is not ready. Wait a moment and try again.');
      }

      const rawCanvas = await exportDrawingToCanvas(svgElement, width, height);
      const ocrCanvas = preprocessForOcr(rawCanvas);

      const ocrText = await recognizeHandwritingFromCanvas(ocrCanvas, (progress) => {
        const pct = Math.round((progress.progress || 0) * 100);
        toast.loading(`Reading handwriting... ${pct}%`, { id: 'ocr' });
      });

      if (!ocrText) {
        toast.error(
          'Could not read any text from the drawing. Try writing larger, clearer letters, or type the row manually.',
          { id: 'ocr', duration: 6000 }
        );
        return;
      }

      toast.loading('Parsing medicine row...', { id: 'ocr' });
      const res = await api.post('/canvas/recognize', { text: ocrText });
      addParsedMedicine(res.data, ocrText);
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.error || error.message || 'Failed to process handwriting';
      toast.error(message, { id: 'ocr' });
    } finally {
      setProcessing(false);
    }
  };

  const addParsedMedicine = (data, fallbackText = '') => {
    const parsed = data?.parsed || {};
    const newMed = {
      id: Date.now().toString(),
      drug: parsed.drugName || data?.text || fallbackText || '',
      dose: parsed.dose || '',
      frequency: parsed.frequency || '',
      duration: parsed.duration || '',
      instructions: parsed.instructions || '',
      isExactMatch: parsed.isExactMatch !== false,
    };

    setMedicines(prev => [...prev, newMed]);
    clearCanvas();
    setManualText('');
    toast.success('Row digitized successfully!', { id: 'ocr' });
  };

  // --- Review Table Editing ---
  const updateMedicine = (id, field, value) => {
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, [field]: value, isExactMatch: true } : m));
  };

  const removeMedicine = (id) => {
    setMedicines(prev => prev.filter(m => m.id !== id));
  };


  // --- Finalize Prescription ---
  const handleFinalize = async () => {
    if (medicines.length === 0 && !notes) {
      toast.error('Prescription cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      toast.loading('Generating Digital Prescription...', { id: 'finalize' });

      const cleanMeds = medicines.map(({ id, isExactMatch, ...rest }) => ({
        drug: rest.drug || rest.name || '',
        dose: rest.dose || '',
        frequency: rest.frequency || '',
        duration: rest.duration || '',
        instructions: rest.instructions || '',
      }));

      await api.post('/prescriptions/confirm', {
        tokenId,
        medicines: cleanMeds,
        notes: notes
      });

      toast.success('Prescription Confirmed & Patient Notified!', { id: 'finalize' });
      navigate('/doctor');

    } catch (error) {
      toast.error('Failed to save prescription.', { id: 'finalize' });
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="canvas-page">
      <div className="canvas-main">

        {/* Header */}
        <div className="canvas-header">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('/doctor')} className="btn btn-secondary" aria-label="Back to dashboard">
              <ArrowLeft size={20}/>
            </button>
            <h1>Write Prescription</h1>
          </div>

          {token && (
            <div className="patient-info-pill">
              Token #{token.number} • {token.patientId?.name || 'Unknown'} • {token.patientId?.age || '?'}yr {token.patientId?.gender || ''}
            </div>
          )}
        </div>

        {/* The Magic iPad Drawing Canvas */}
        <div className="drawing-area-container">
          <div className="drawing-toolbar">
            <div className="flex items-center gap-2">
              <PenTool size={18} style={{ color: 'var(--brand)' }}/>
              <span className="toolbar-label">Digital Pad</span>
              <span className="toolbar-hint">
                Draw and recognize locally, or type a row below
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id="manual-medicine-row"
                name="manualMedicineRow"
                type="text"
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                placeholder="e.g. Amoxicillin 500mg TDS x 5 days"
                className="manual-text-input"
              />
              <button type="button" className="btn btn-secondary" onClick={clearCanvas} disabled={!hasDrawing}>
                <Eraser size={16}/> Clear Area
              </button>
              <button type="button" className="btn btn-primary" onClick={handleRecognize} disabled={processing || (!hasDrawing && !manualText.trim())}>
                {processing ? 'Processing...' : <><Wand2 size={16}/> Recognize Row</>}
              </button>
            </div>
          </div>

          <div
            className="drawing-surface"
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <svg
              viewBox={surfaceSize.width > 0 ? `0 0 ${surfaceSize.width} ${surfaceSize.height}` : undefined}
              width="100%"
              height="100%"
            >
              {strokes.map((stroke, i) => (
                <path
                  key={i}
                  d={getSvgPathFromStroke(getStroke(stroke, { size: 6, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))}
                  fill="black"
                />
              ))}
              {currentPoints.length > 0 && (
                <path
                  d={getSvgPathFromStroke(getStroke(currentPoints, { size: 6, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))}
                  fill="black"
                />
              )}
            </svg>
          </div>
        </div>

        {/* The Review & Editable Table */}
        <div className="medicine-table-container">
          <div className="table-header">
             <h2><CheckSquare size={20} style={{ color: 'var(--success)' }}/> Parsed Medicines</h2>
             <span className="table-header__hint">Dotted red lines indicate fuzzy matches. Click to edit.</span>
          </div>

          <table className="medicine-table">
            <thead>
              <tr>
                <th width="35%">Medicine Name</th>
                <th width="20%">Dose</th>
                <th width="20%">Frequency</th>
                <th width="20%">Duration</th>
                <th width="5%"></th>
              </tr>
            </thead>
            <tbody>
              {medicines.length === 0 ? (
                <tr><td colSpan="5" className="empty-table-row">No medicines added yet. Write above and process!</td></tr>
              ) : (
                medicines.map(med => (
                  <tr key={med.id}>
                    <td>
                      <input
                        id={`medicine-drug-${med.id}`}
                        name={`medicineDrug-${med.id}`}
                        value={med.drug}
                        onChange={(e) => updateMedicine(med.id, 'drug', e.target.value)}
                        className={!med.isExactMatch ? 'drug-warning text-red-700 font-semibold' : 'font-semibold text-slate-800'}
                        title={!med.isExactMatch ? 'Fuzzy match. Is this what you meant?' : ''}
                      />
                    </td>
                    <td><input id={`medicine-dose-${med.id}`} name={`medicineDose-${med.id}`} value={med.dose} onChange={(e) => updateMedicine(med.id, 'dose', e.target.value)} placeholder="e.g. 500mg"/></td>
                    <td><input id={`medicine-frequency-${med.id}`} name={`medicineFrequency-${med.id}`} value={med.frequency} onChange={(e) => updateMedicine(med.id, 'frequency', e.target.value)} placeholder="e.g. 1-0-1"/></td>
                    <td><input id={`medicine-duration-${med.id}`} name={`medicineDuration-${med.id}`} value={med.duration} onChange={(e) => updateMedicine(med.id, 'duration', e.target.value)} placeholder="e.g. 5 days"/></td>
                    <td><button type="button" onClick={() => removeMedicine(med.id)} className="text-red-400 hover:text-red-600 p-2" aria-label="Remove medicine"><Trash2 size={18}/></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-8">
            <h3 className="notes-label">Clinical Notes & Advice (Optional)</h3>
            <textarea
              id="clinical-notes"
              name="clinicalNotes"
              className="rx-notes-area"
              placeholder="e.g. Drink plenty of water. Return if fever persists..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="finalize-bar">
             <button type="button" className="btn btn-secondary" onClick={() => navigate('/doctor')}>Cancel</button>
             <button type="button" className="btn btn-primary" onClick={handleFinalize} disabled={saving}>
               {saving ? 'Saving...' : <><Save size={18}/> Finalize & Notify Patient</>}
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Canvas;

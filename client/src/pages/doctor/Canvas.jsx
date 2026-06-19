import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStroke } from 'perfect-freehand';
import { PenTool, Eraser, Trash2, Wand2, CheckSquare, Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
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

  // Freehand State
  const [strokes, setStrokes] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // App State
  const [token, setToken] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [notes, setNotes] = useState('');
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch token basics so we know patient info
  useEffect(() => {
    fetchTokenInfo();
  }, [tokenId]);

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

  // --- Drawing Handlers ---
  const handlePointerDown = (e) => {
    setIsDrawing(true);
    const rect = containerRef.current.getBoundingClientRect();
    setCurrentPoints([[e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5]]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCurrentPoints(prev => [...prev, [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5]]);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    if (currentPoints.length > 0) {
      setStrokes(prev => [...prev, currentPoints]);
      setCurrentPoints([]);
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentPoints([]);
  };

  // --- TrOCR Processing ---
  const handleRecognize = async () => {
    if (strokes.length === 0 && currentPoints.length === 0 && !manualText.trim()) {
      toast.error('Write on the pad or type the medicine row in the text box.');
      return;
    }

    try {
      setProcessing(true);
      toast.loading(
        manualText.trim() ? 'Parsing medicine row...' : 'Running Handwriting Recognition...',
        { id: 'ocr' }
      );

      // Manual text path — no Hugging Face call needed.
      if (manualText.trim()) {
        const res = await api.post('/canvas/recognize', { text: manualText.trim() });
        addParsedMedicine(res.data, manualText.trim());
        return;
      }

      let imagePayload;
      const svgElement = containerRef.current.querySelector('svg');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = svgElement.clientWidth;
      canvas.height = svgElement.clientHeight;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      imagePayload = await new Promise((resolve) => {
        const img = new Image();
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = url;
      });

      const res = await api.post('/canvas/recognize', { image: imagePayload });
      addParsedMedicine(res.data);
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.error || 'Failed to process handwriting';

      if (error.response?.data?.ocrUnavailable) {
        toast.error(
          'Drawing OCR is not available on free Hugging Face. Type the row in the text box and click Recognize.',
          { id: 'ocr', duration: 7000 }
        );
      } else {
        toast.error(message, { id: 'ocr' });
      }
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
      isExactMatch: parsed.isExactMatch !== false,
    };

    setMedicines([...medicines, newMed]);
    clearCanvas();
    setManualText('');
    toast.success('Row digitized successfully!', { id: 'ocr' });
  };

  // --- Review Table Editing ---
  const updateMedicine = (id, field, value) => {
    setMedicines(medicines.map(m => m.id === id ? { ...m, [field]: value, isExactMatch: true } : m));
  };
  
  const removeMedicine = (id) => {
    setMedicines(medicines.filter(m => m.id !== id));
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

      // Clean up local IDs before sending
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
      navigate('/doctor'); // Go back to dashboard queue

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
                Type a row below (recommended) or draw and recognize
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                placeholder="e.g. Amoxicillin 500mg TDS x 5 days (works without OCR)"
                className="manual-text-input"
              />
              <button type="button" className="btn btn-secondary" onClick={clearCanvas} disabled={strokes.length === 0 && currentPoints.length === 0}>
                <Eraser size={16}/> Clear Area
              </button>
              <button className="btn btn-primary" onClick={handleRecognize} disabled={processing || ((strokes.length === 0 && currentPoints.length === 0) && !manualText.trim())}>
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
            onPointerLeave={handlePointerUp}
          >
            <svg>
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
                        value={med.drug} 
                        onChange={(e) => updateMedicine(med.id, 'drug', e.target.value)}
                        className={!med.isExactMatch ? 'drug-warning text-red-700 font-semibold' : 'font-semibold text-slate-800'}
                        title={!med.isExactMatch ? 'Fuzzy match. Is this what you meant?' : ''}
                      />
                    </td>
                    <td><input value={med.dose} onChange={(e) => updateMedicine(med.id, 'dose', e.target.value)} placeholder="e.g. 500mg"/></td>
                    <td><input value={med.frequency} onChange={(e) => updateMedicine(med.id, 'frequency', e.target.value)} placeholder="e.g. 1-0-1"/></td>
                    <td><input value={med.duration} onChange={(e) => updateMedicine(med.id, 'duration', e.target.value)} placeholder="e.g. 5 days"/></td>
                    <td><button onClick={() => removeMedicine(med.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18}/></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-8">
            <h3 className="notes-label">Clinical Notes & Advice (Optional)</h3>
            <textarea 
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

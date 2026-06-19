import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import './PrescriptionView.css';

function stripDoctorPrefix(name) {
  return String(name || '')
    .trim()
    .replace(/^(?:Dr\.?\s*)+/i, '')
    .trim();
}

function formatDoctorLabel(name) {
  const cleaned = stripDoctorPrefix(name);
  if (!cleaned) return 'Dr. Unknown';
  return `Dr. ${cleaned}`;
}

function formatDoctorSignature(name) {
  const cleaned = stripDoctorPrefix(name);
  if (!cleaned) return 'Sign';
  return cleaned.split(/\s+/)[0] || 'Sign';
}

const PrescriptionView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrescription();
  }, [id]);

  const fetchPrescription = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/prescriptions/${id}`);
      if (res.data?.success) {
        setData(res.data.prescription);
      }
    } catch (error) {
       toast.error('Failed to load prescription.');
       navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="rx-view-container rx-loading">Loading document…</div>;
  }

  if (!data) return null;

  const { patientId, doctorId, storeId, medicines, clinicalNotes, createdAt } = data;

  return (
    <div className="rx-view-container" style={{ WebkitPrintColorAdjust: 'exact' }}>
      
      <div className="rx-actions no-print">
        <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => toast.success('PDF downloading…')}>
            <Download size={18} /> Download
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
            <Printer size={18} /> Print Rx
          </button>
        </div>
      </div>

      <div className="rx-paper">
         
         <div className="rx-header">
           <div className="rx-hospital-name">{storeId?.name || doctorId?.storeId?.name || 'DocNet Hospital'}</div>
           <div className="rx-hospital-address">{storeId?.address || doctorId?.storeId?.address || 'City Center, Main Road'}</div>
           <div className="rx-doctor-name">{formatDoctorLabel(doctorId?.userId?.name)}</div>
           <div className="rx-doctor-creds">{doctorId?.specialization || 'General'} • {doctorId?.department || 'OPD'}</div>
         </div>

         <div className="rx-meta">
            <div>
              <span className="rx-meta-label">Patient Name:</span>
              <span>{patientId?.name?.toUpperCase()}</span>
            </div>
            <div className="text-right">
              <span className="rx-meta-label">Date:</span>
              <span>{new Date(createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div>
              <span className="rx-meta-label">Age/Sex:</span>
              <span>{patientId?.age || '?'} Y / {patientId?.gender || 'U'}</span>
            </div>
            <div className="text-right">
              <span className="rx-meta-label">Rx ID:</span>
              <span>{data._id.substring(18, 24).toUpperCase()}</span>
            </div>
         </div>

         <div className="rx-symbol">℞</div>

         {medicines && medicines.length > 0 ? (
           <table className="rx-table">
             <thead>
               <tr>
                 <th width="45%">Medicine</th>
                 <th width="20%">Frequency</th>
                 <th width="20%">Duration</th>
                 <th width="15%" className="text-right">Dose</th>
               </tr>
             </thead>
             <tbody>
               {medicines.map((med, idx) => (
                 <tr key={idx}>
                   <td className="rx-drug-name">{med.drug || med.name}</td>
                   <td>{med.frequency}</td>
                   <td>{med.duration}</td>
                   <td className="text-right">{med.dose}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         ) : (
           <div className="rx-empty">No medicines prescribed.</div>
         )}

         {clinicalNotes && (
           <div className="rx-notes-section">
             <h3>Clinical Advice / Investigations</h3>
             <div className="rx-notes-content">
               {clinicalNotes}
             </div>
           </div>
         )}

         <div className="rx-footer">
            <div className="rx-signature">
               <div style={{ fontFamily: "'Mrs Saint Delafield', cursive", fontSize: '2rem', marginBottom: '0.5rem', color: '#000' }}>
                 Dr. {formatDoctorSignature(doctorId?.userId?.name)}
               </div>
               <div className="rx-signature-label">Authorized Signature</div>
            </div>
         </div>

      </div>

    </div>
  );
};

export default PrescriptionView;

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Zap, Plus, Download, Settings, Calculator, List, Lightbulb, Grid, AlertCircle, CheckCircle } from 'lucide-react';

const ElectricalPlannerMVP = () => {
  const [step, setStep] = useState('upload');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [scale, setScale] = useState('1:50');
  const [rooms, setRooms] = useState([]);
  const [symbols, setSymbols] = useState([]);
  const [circuits, setCircuits] = useState([]);
  const [bom, setBom] = useState(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // NEK 400 Rules Configuration
  const nekRules = {
    livingRoom: {
      minSockets: 6,
      socketsPer4m2: 1,
      spotsPer3to4m2: 1
    },
    bedroom: {
      minSockets: 4,
      spotsPer3to4m2: 1
    },
    kitchen: {
      socketsPerMeterCounter: 0.67,
      minSockets: 6,
      spots: 4
    },
    bathroom: {
      spots: 2,
      sockets: 1
    },
    hallway: {
      socketsPerPer6m2: 1,
      minSockets: 2
    }
  };

  // Sample rooms from the floor plan
  const sampleRooms = [
    { id: 1, name: 'Stue', type: 'livingRoom', area: 22, x: 50, y: 50, width: 200, height: 150 },
    { id: 2, name: 'Kjøkken', type: 'kitchen', area: 12, x: 280, y: 50, width: 150, height: 100 },
    { id: 3, name: 'Soverom 1', type: 'bedroom', area: 9, x: 50, y: 230, width: 120, height: 100 },
    { id: 4, name: 'Soverom 2', type: 'bedroom', area: 10, x: 200, y: 230, width: 130, height: 100 },
    { id: 5, name: 'Bad', type: 'bathroom', area: 9, x: 360, y: 180, width: 90, height: 100 },
    { id: 6, name: 'Gang', type: 'hallway', area: 10, x: 280, y: 180, width: 60, height: 100 }
  ];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
        setStep('detect');
        // Auto-detect rooms (simplified for MVP)
        setTimeout(() => {
          setRooms(sampleRooms);
          setStep('review');
        }, 1500);
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateElectricalLayout = () => {
    const newSymbols = [];
    const newCircuits = [];
    let circuitId = 1;
    let socketsInCircuit = 0;
    const maxSocketsPerCircuit = 10;

    rooms.forEach(room => {
      const rule = nekRules[room.type];
      if (!rule) return;

      // Calculate required sockets
      let sockets = rule.minSockets || 0;
      if (rule.socketsPer4m2 && room.area > 20) {
        sockets += Math.floor((room.area - 20) / 4);
      }
      if (rule.socketsPerPer6m2) {
        sockets = Math.max(sockets, Math.ceil(room.area / 6) * rule.socketsPerPer6m2);
      }

      // Calculate spots
      let spots = 0;
      if (rule.spotsPer3to4m2) {
        spots = Math.ceil(room.area / 3.5);
      } else if (rule.spots) {
        spots = rule.spots;
      }

      // Place sockets along walls
      const socketSpacing = Math.max(room.width, room.height) / (sockets + 1);
      for (let i = 0; i < sockets; i++) {
        if (socketsInCircuit >= maxSocketsPerCircuit) {
          circuitId++;
          socketsInCircuit = 0;
        }

        const x = room.x + (i % 2 === 0 ? 10 : room.width - 10);
        const y = room.y + ((i / 2) * socketSpacing) % room.height;

        newSymbols.push({
          id: `socket-${room.id}-${i}`,
          type: 'socket',
          room: room.name,
          x,
          y,
          circuit: `C${circuitId}`
        });
        socketsInCircuit++;
      }

      // Place spots in grid
      const spotsPerRow = Math.ceil(Math.sqrt(spots));
      const spotSpacingX = room.width / (spotsPerRow + 1);
      const spotSpacingY = room.height / (Math.ceil(spots / spotsPerRow) + 1);

      for (let i = 0; i < spots; i++) {
        const row = Math.floor(i / spotsPerRow);
        const col = i % spotsPerRow;
        newSymbols.push({
          id: `spot-${room.id}-${i}`,
          type: 'spot',
          room: room.name,
          x: room.x + (col + 1) * spotSpacingX,
          y: room.y + (row + 1) * spotSpacingY,
          circuit: `C${circuitId}`
        });
      }

      // Place switch near door
      newSymbols.push({
        id: `switch-${room.id}`,
        type: 'switch',
        room: room.name,
        x: room.x + 20,
        y: room.y + 20,
        circuit: `C${circuitId}`
      });
    });

    setSymbols(newSymbols);

    // Create circuit summary
    const circuitSummary = [];
    for (let i = 1; i <= circuitId; i++) {
      const circuitSymbols = newSymbols.filter(s => s.circuit === `C${i}`);
      const socketsCount = circuitSymbols.filter(s => s.type === 'socket').length;
      const spotsCount = circuitSymbols.filter(s => s.type === 'spot').length;
      const switchesCount = circuitSymbols.filter(s => s.type === 'switch').length;

      circuitSummary.push({
        id: `C${i}`,
        sockets: socketsCount,
        spots: spotsCount,
        switches: switchesCount,
        cableLength: Math.floor(Math.random() * 30 + 20), // Simplified
        cableSize: '1.5 mm²'
      });
    }
    setCircuits(circuitSummary);

    // Generate BOM
    generateBOM(newSymbols, circuitSummary);
    setStep('result');
  };

  const generateBOM = (symbolsList, circuitsList) => {
    const totalSockets = symbolsList.filter(s => s.type === 'socket').length;
    const totalSpots = symbolsList.filter(s => s.type === 'spot').length;
    const totalSwitches = symbolsList.filter(s => s.type === 'switch').length;
    const totalCableLength = circuitsList.reduce((sum, c) => sum + c.cableLength, 0);

    setBom({
      byRoom: rooms.map(room => ({
        name: room.name,
        sockets: symbolsList.filter(s => s.type === 'socket' && s.room === room.name).length,
        spots: symbolsList.filter(s => s.type === 'spot' && s.room === room.name).length,
        switches: symbolsList.filter(s => s.type === 'switch' && s.room === room.name).length
      })),
      byCircuit: circuitsList,
      totals: {
        sockets: totalSockets,
        spots: totalSpots,
        switches: totalSwitches,
        cable15mm: totalCableLength,
        cable25mm: Math.floor(totalCableLength * 0.3),
        junctionBoxes: circuitsList.length
      }
    });
  };

  useEffect(() => {
    if (step === 'result' && canvasRef.current && uploadedImage) {
      drawCanvas();
    }
  }, [step, symbols, uploadedImage]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw floor plan
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Draw rooms
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    rooms.forEach(room => {
      ctx.strokeRect(room.x, room.y, room.width, room.height);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(room.x, room.y, room.width, room.height);

      ctx.fillStyle = '#1e40af';
      ctx.font = '12px sans-serif';
      ctx.fillText(room.name, room.x + 5, room.y + 15);
      ctx.fillText(`${room.area} m²`, room.x + 5, room.y + 30);
    });

    // Draw symbols
    symbols.forEach(symbol => {
      const circuitColors = {
        'C1': '#ef4444',
        'C2': '#f97316',
        'C3': '#eab308',
        'C4': '#22c55e',
        'C5': '#06b6d4',
        'C6': '#8b5cf6'
      };

      ctx.fillStyle = circuitColors[symbol.circuit] || '#6b7280';

      if (symbol.type === 'socket') {
        // Draw socket symbol
        ctx.beginPath();
        ctx.arc(symbol.x, symbol.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(symbol.x - 3, symbol.y);
        ctx.lineTo(symbol.x + 3, symbol.y);
        ctx.stroke();
      } else if (symbol.type === 'spot') {
        // Draw spot symbol
        ctx.beginPath();
        ctx.arc(symbol.x, symbol.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (symbol.type === 'switch') {
        // Draw switch symbol
        ctx.fillRect(symbol.x - 5, symbol.y - 5, 10, 10);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(symbol.x - 5, symbol.y - 5, 10, 10);
      }
    });

    // Draw legend
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, canvas.height - 100, 180, 90);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, canvas.height - 100, 180, 90);

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Legend:', 20, canvas.height - 80);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(20, canvas.height - 65, 10, 10);
    ctx.fillStyle = '#374151';
    ctx.fillText('Socket', 35, canvas.height - 57);

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(25, canvas.height - 45, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.fillText('Spotlight', 35, canvas.height - 40);

    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(20, canvas.height - 30, 10, 10);
    ctx.fillStyle = '#374151';
    ctx.fillText('Switch', 35, canvas.height - 22);
  };

  const downloadPDF = () => {
    alert('PDF export functionality would be implemented here. It would include:\n- Floor plan with electrical overlay\n- Bill of Materials table\n- Circuit diagrams');
  };

  const downloadBOM = () => {
    if (!bom) return;

    let csv = 'Room,Sockets,Spots,Switches\n';
    bom.byRoom.forEach(room => {
      csv += `${room.name},${room.sockets},${room.spots},${room.switches}\n`;
    });

    csv += '\nCircuit,Sockets,Spots,Switches,Cable Length,Cable Size\n';
    bom.byCircuit.forEach(circuit => {
      csv += `${circuit.id},${circuit.sockets},${circuit.spots},${circuit.switches},${circuit.cableLength}m,${circuit.cableSize}\n`;
    });

    csv += '\nTotal Summary\n';
    csv += `Total Sockets,${bom.totals.sockets}\n`;
    csv += `Total Spots,${bom.totals.spots}\n`;
    csv += `Total Switches,${bom.totals.switches}\n`;
    csv += `Cable 1.5mm²,${bom.totals.cable15mm}m\n`;
    csv += `Cable 2.5mm²,${bom.totals.cable25mm}m\n`;
    csv += `Junction Boxes,${bom.totals.junctionBoxes}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'electrical-bom.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Zap className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">NEK 400 Electrical Planner</h1>
                <p className="text-gray-600">Automated electrical installation design tool</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Scale: {scale}</p>
              <p className="text-sm text-gray-500">Project: Varteigveien 66</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            {['upload', 'detect', 'review', 'result'].map((s, idx) => (
              <div key={s} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  step === s ? 'bg-indigo-600 text-white' : 
                  ['upload', 'detect', 'review'].indexOf(step) > idx ? 'bg-green-500 text-white' : 
                  'bg-gray-200 text-gray-500'
                }`}>
                  {['upload', 'detect', 'review'].indexOf(step) > idx ? <CheckCircle className="w-6 h-6" /> : idx + 1}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700 capitalize">{s}</span>
                {idx < 3 && <div className="w-16 h-1 bg-gray-200 mx-4" />}
              </div>
            ))}
          </div>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <Upload className="mr-2" /> Upload Floor Plan
            </h2>
            <div className="border-4 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-500 transition-colors">
              <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-xl text-gray-600 mb-4">Drop your floor plan here or click to browse</p>
              <p className="text-sm text-gray-500 mb-6">Supported formats: PDF, PNG, JPG</p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg cursor-pointer hover:bg-indigo-700 inline-block"
              >
                Select File
              </label>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Floor Plan Scale
              </label>
              <select
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option>1:50</option>
                <option>1:100</option>
              </select>
            </div>
          </div>
        )}

        {/* Detecting Step */}
        {step === 'detect' && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Analyzing Floor Plan...</h2>
            <p className="text-gray-600">Detecting rooms, walls, and dimensions</p>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <Grid className="mr-2" /> Review Detected Rooms
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {rooms.map(room => (
                <div key={room.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{room.name}</h3>
                      <p className="text-gray-600 text-sm capitalize">{room.type.replace(/([A-Z])/g, ' $1').trim()}</p>
                    </div>
                    <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                      {room.area} m²
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>Min sockets: {nekRules[room.type]?.minSockets || 'N/A'}</p>
                    <p>Lighting: Auto-calculated</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={calculateElectricalLayout}
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 flex items-center justify-center text-lg font-semibold"
            >
              <Calculator className="mr-2" /> Generate Electrical Layout
            </button>
          </div>
        )}

        {/* Result Step */}
        {step === 'result' && (
          <div className="space-y-6">
            {/* Canvas */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <Zap className="mr-2" /> Electrical Installation Plan
              </h2>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full"
                />
                <img
                  ref={imageRef}
                  src={uploadedImage || ''}
                  className="hidden"
                  onLoad={drawCanvas}
                  alt=""
                />
              </div>
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={downloadPDF}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center"
                >
                  <Download className="mr-2 w-4 h-4" /> Download PDF
                </button>
                <button
                  onClick={downloadBOM}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                >
                  <Download className="mr-2 w-4 h-4" /> Download BOM (CSV)
                </button>
              </div>
            </div>

            {/* Circuits Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center">
                <List className="mr-2" /> Circuits Overview
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Circuit</th>
                      <th className="px-4 py-2 text-left">Sockets</th>
                      <th className="px-4 py-2 text-left">Spots</th>
                      <th className="px-4 py-2 text-left">Switches</th>
                      <th className="px-4 py-2 text-left">Cable</th>
                      <th className="px-4 py-2 text-left">Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {circuits.map(circuit => (
                      <tr key={circuit.id} className="border-t">
                        <td className="px-4 py-2 font-semibold">{circuit.id}</td>
                        <td className="px-4 py-2">{circuit.sockets}</td>
                        <td className="px-4 py-2">{circuit.spots}</td>
                        <td className="px-4 py-2">{circuit.switches}</td>
                        <td className="px-4 py-2">{circuit.cableSize}</td>
                        <td className="px-4 py-2">{circuit.cableLength} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BOM */}
            {bom && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center">
                  <Calculator className="mr-2" /> Bill of Materials
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Sockets</p>
                    <p className="text-3xl font-bold text-blue-600">{bom.totals.sockets}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Spotlights</p>
                    <p className="text-3xl font-bold text-green-600">{bom.totals.spots}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Switches</p>
                    <p className="text-3xl font-bold text-purple-600">{bom.totals.switches}</p>
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-3">Cable Requirements</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="border border-gray-200 p-4 rounded-lg">
                    <p className="text-gray-600">Cable 1.5 mm²</p>
                    <p className="text-xl font-bold">{bom.totals.cable15mm} m</p>
                  </div>
                  <div className="border border-gray-200 p-4 rounded-lg">
                    <p className="text-gray-600">Cable 2.5 mm²</p>
                    <p className="text-xl font-bold">{bom.totals.cable25mm} m</p>
                  </div>
                  <div className="border border-gray-200 p-4 rounded-lg">
                    <p className="text-gray-600">Junction Boxes</p>
                    <p className="text-xl font-bold">{bom.totals.junctionBoxes}</p>
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-3">Per Room Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Room</th>
                        <th className="px-4 py-2 text-left">Sockets</th>
                        <th className="px-4 py-2 text-left">Spots</th>
                        <th className="px-4 py-2 text-left">Switches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bom.byRoom.map(room => (
                        <tr key={room.name} className="border-t">
                          <td className="px-4 py-2 font-medium">{room.name}</td>
                          <td className="px-4 py-2">{room.sockets}</td>
                          <td className="px-4 py-2">{room.spots}</td>
                          <td className="px-4 py-2">{room.switches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Compliance Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-1">NEK 400 Compliance Notice</h3>
                  <p className="text-sm text-yellow-800">
                    This is an assistive planning tool and does not replace professional electrical design certification. 
                    All installations must be verified by a qualified electrician and comply with current NEK 400 standards.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ElectricalPlannerMVP;

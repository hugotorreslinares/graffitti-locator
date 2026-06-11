import { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  Layers, 
  PlusCircle, 
  BarChart3, 
  Search, 
  Plus, 
  User, 
  Calendar, 
  Map as MapIcon, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Types
interface GraffitiReport {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  style: string;
  image_url: string;
  spotted_by: string;
  created_at: string;
}

interface StatsSummary {
  total: number;
  styleCounts: { style: string; count: number }[];
  latest: GraffitiReport | null;
}

// Preset Images for the Report Form
const IMAGE_PRESETS = [
  { id: 'mural', label: 'Brooklyn Love', path: '/images/mural.png' },
  { id: 'stencil', label: 'Balloon Monkey', path: '/images/stencil.png' },
  { id: 'piece', label: 'Urban Pulse', path: '/images/piece.png' }
];

// Helper to create custom colored & pulsing Leaflet markers
const createCustomIcon = (style: string) => {
  const normStyle = style.toLowerCase().replace(' ', '-');
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="marker-pulse style-${normStyle}"></div><div class="marker-pin style-${normStyle}"></div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -40]
  });
};

// Map component helper to auto-center when a report is selected
function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1 });
  }, [center, zoom, map]);
  return null;
}

// Map component helper to handle map clicks for selecting coordinates
function MapClickHandler({ onMapClick, active }: { onMapClick: (lat: number, lng: number) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<'map' | 'gallery' | 'analytics' | 'report'>('map');
  const [reports, setReports] = useState<GraffitiReport[]>([]);
  const [stats, setStats] = useState<StatsSummary>({ total: 0, styleCounts: [], latest: null });
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStyle, setFilterStyle] = useState('all');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    latitude: '',
    longitude: '',
    style: 'Mural',
    image_url: '/images/mural.png',
    spotted_by: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coordinatePickerActive, setCoordinatePickerActive] = useState(false);
  
  // Custom Toast State
  const [toast, setToast] = useState<string | null>(null);

  // Default Map center (New York City area)
  const defaultCenter: [number, number] = [40.7128, -74.0060];
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState(12);

  // Trigger Toast Notification
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch Reports and Stats from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const reportsRes = await fetch('/api/graffiti');
      const reportsData = await reportsRes.json();
      setReports(reportsData);

      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching API data:', error);
      showToast('Failed to load data from Neon database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle clicking card in Sidebar/Gallery to highlight on Map
  const handleSelectReport = (report: GraffitiReport) => {
    setMapCenter([report.latitude, report.longitude]);
    setMapZoom(15);
    setSelectedReportId(report.id);
    setCurrentTab('map');
  };

  // Handle clicking on map to choose coordinates
  const handleMapClick = (lat: number, lng: number) => {
    if (coordinatePickerActive) {
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
      }));
      setCoordinatePickerActive(false);
      setCurrentTab('report');
      showToast(`Coordinates set to: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  // Handle preset image selection in form
  const handlePresetSelect = (path: string) => {
    setFormData(prev => ({ ...prev, image_url: path }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.latitude || !formData.longitude || !formData.style) {
      showToast('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/graffiti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Server responded with an error');
      }

      const newReport = await response.json();
      showToast('Graffiti report submitted successfully to Neon!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        latitude: '',
        longitude: '',
        style: 'Mural',
        image_url: '/images/mural.png',
        spotted_by: ''
      });

      // Reload DB content and head to the map showing the new item
      await fetchData();
      setMapCenter([newReport.latitude, newReport.longitude]);
      setMapZoom(15);
      setSelectedReportId(newReport.id);
      setCurrentTab('map');

    } catch (err) {
      console.error(err);
      showToast('Error saving report to the database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Search Logic
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = 
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.spotted_by.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStyle = filterStyle === 'all' || r.style.toLowerCase() === filterStyle.toLowerCase();
      
      return matchesSearch && matchesStyle;
    });
  }, [reports, searchQuery, filterStyle]);

  // Compute stats locally if API data hasn't loaded fully or styles need real-time update
  const styleBreakdown = useMemo(() => {
    const total = reports.length;
    if (total === 0) return [];

    const counts: { [key: string]: number } = {
      'mural': 0,
      'stencil': 0,
      'piece': 0,
      'tag': 0,
      'throw-up': 0
    };

    reports.forEach(r => {
      const normStyle = r.style.toLowerCase();
      if (normStyle in counts) {
        counts[normStyle]++;
      }
    });

    return Object.keys(counts).map(key => ({
      name: key,
      count: counts[key],
      percentage: Math.round((counts[key] / total) * 100)
    })).sort((a, b) => b.count - a.count);

  }, [reports]);

  return (
    <div className="app-container">
      {/* Toast Banner */}
      {toast && (
        <div className="notification-toast">
          <CheckCircle2 size={18} color="#39FF14" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <Sparkles className="logo-icon" size={26} />
          <h1 className="logo-text">URBAN PULSE</h1>
        </div>
        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${currentTab === 'map' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('map'); setCoordinatePickerActive(false); }}
          >
            <MapIcon size={16} />
            <span>Street Map</span>
          </button>
          <button 
            className={`nav-tab ${currentTab === 'gallery' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('gallery'); setCoordinatePickerActive(false); }}
          >
            <Layers size={16} />
            <span>Gallery</span>
          </button>
          <button 
            className={`nav-tab ${currentTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('analytics'); setCoordinatePickerActive(false); }}
          >
            <BarChart3 size={16} />
            <span>Analytics</span>
          </button>
          <button 
            className={`nav-tab tab-report ${currentTab === 'report' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('report'); setCoordinatePickerActive(false); }}
          >
            <PlusCircle size={16} />
            <span>Report Art</span>
          </button>
        </nav>
      </header>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* VIEW 1: MAP VIEW */}
        {currentTab === 'map' && (
          <div className="map-view-container">
            {/* Sidebar for Map */}
            <aside className="map-sidebar">
              <div className="sidebar-header">
                <h2 className="sidebar-title">Spotted Artworks</h2>
                <p className="sidebar-desc">Select a piece to navigate on the map</p>
              </div>
              <div className="sidebar-list">
                {loading ? (
                  <div className="loader-container" style={{ minHeight: '150px' }}>
                    <div className="spinner" style={{ width: '30px', height: '30px' }}></div>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                    <p>No graffiti reported yet.</p>
                  </div>
                ) : (
                  reports.map(r => (
                    <div 
                      key={r.id}
                      className={`sidebar-card ${selectedReportId === r.id ? 'selected' : ''}`}
                      onClick={() => handleSelectReport(r)}
                    >
                      <img 
                        src={r.image_url || '/images/mural.png'} 
                        alt={r.title} 
                        className="sidebar-card-img" 
                      />
                      <div className="sidebar-card-info">
                        <div>
                          <h4 className="sidebar-card-title">{r.title}</h4>
                          <span className={`sidebar-card-style style-${r.style.toLowerCase().replace(' ', '-')}`}>
                            {r.style}
                          </span>
                        </div>
                        <span className="sidebar-card-spotted">By {r.spotted_by}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Leaflet Interactive Map */}
            <div className="map-wrapper">
              {coordinatePickerActive && (
                <div className="map-helper">
                  <MapPin className="logo-icon" size={16} />
                  <span>Click anywhere on the map to set coordinate location</span>
                </div>
              )}
              <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <ChangeMapView center={mapCenter} zoom={mapZoom} />
                <MapClickHandler onMapClick={handleMapClick} active={coordinatePickerActive} />
                
                {/* Custom Styled Neon Map Tiles (CartoDB Dark Matter) */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Markers */}
                {reports.map(r => (
                  <Marker 
                    key={r.id} 
                    position={[r.latitude, r.longitude]}
                    icon={createCustomIcon(r.style)}
                    eventHandlers={{
                      click: () => {
                        setSelectedReportId(r.id);
                        setMapCenter([r.latitude, r.longitude]);
                      }
                    }}
                  >
                    <Popup>
                      <div className="popup-card">
                        <img src={r.image_url || '/images/mural.png'} alt={r.title} className="popup-img" />
                        <div className="popup-details">
                          <h4 className="popup-title">{r.title}</h4>
                          <p style={{ fontSize: '0.8rem', color: '#8F9CAE', margin: '0.25rem 0' }}>{r.description}</p>
                          <div className="popup-meta">
                            <span className={`sidebar-card-style style-${r.style.toLowerCase().replace(' ', '-')}`}>
                              {r.style}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#5C6C82' }}>By {r.spotted_by}</span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: GALLERY VIEW */}
        {currentTab === 'gallery' && (
          <div className="view-panel">
            <div className="view-title-container">
              <h2 className="view-title">Street Art Gallery</h2>
              <button className="btn btn-primary" onClick={() => setCurrentTab('report')}>
                <Plus size={16} />
                <span>Add New Artwork</span>
              </button>
            </div>

            <div className="gallery-filters">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by title, description or artist..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-tags">
                {['all', 'mural', 'stencil', 'piece', 'tag', 'throw-up'].map(style => (
                  <button
                    key={style}
                    className={`filter-tag style-${style} ${filterStyle === style ? 'active' : ''}`}
                    onClick={() => setFilterStyle(style)}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="loader-container">
                <div className="spinner"></div>
                <p>Loading gallery items...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="empty-state">
                <AlertCircle className="empty-state-icon" size={48} />
                <h3>No Artworks Found</h3>
                <p style={{ marginTop: '0.5rem' }}>No results match your search parameters. Try reporting some new street art!</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {filteredReports.map(r => (
                  <div key={r.id} className="graffiti-card">
                    <div className="card-img-wrapper">
                      <img src={r.image_url || '/images/mural.png'} alt={r.title} className="card-img" />
                      <span className={`style-badge ${r.style.toLowerCase().replace(' ', '-')}`}>
                        {r.style}
                      </span>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">{r.title}</h3>
                      <p className="card-desc">{r.description || 'No description provided.'}</p>
                      
                      <div className="card-footer">
                        <span className="card-footer-item">
                          <User size={12} />
                          <span>Spotted by {r.spotted_by}</span>
                        </span>
                        <span className="card-footer-item">
                          <Calendar size={12} />
                          <span>{new Date(r.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>

                      <button 
                        className="btn btn-secondary" 
                        style={{ marginTop: '1rem', width: '100%', justifyContent: 'center', padding: '0.5rem' }}
                        onClick={() => handleSelectReport(r)}
                      >
                        <MapIcon size={14} />
                        <span>Locate on Map</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: ANALYTICS VIEW */}
        {currentTab === 'analytics' && (
          <div className="view-panel">
            <h2 className="view-title" style={{ marginBottom: '2rem' }}>Analytics Dashboard</h2>
            
            {loading ? (
              <div className="loader-container">
                <div className="spinner"></div>
                <p>Calculating database metrics...</p>
              </div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-card cyan">
                    <div className="stat-icon-wrapper cyan">
                      <MapPin size={24} />
                    </div>
                    <div className="stat-details">
                      <span className="stat-value">{stats.total}</span>
                      <span className="stat-label">Total Reports</span>
                    </div>
                  </div>

                  <div className="stat-card purple">
                    <div className="stat-icon-wrapper purple">
                      <Sparkles size={24} />
                    </div>
                    <div className="stat-details">
                      <span className="stat-value">
                        {stats.styleCounts.length > 0 ? stats.styleCounts.reduce((max, s) => s.count > max.count ? s : max, stats.styleCounts[0]).style : 'N/A'}
                      </span>
                      <span className="stat-label">Primary Style</span>
                    </div>
                  </div>

                  <div className="stat-card pink">
                    <div className="stat-icon-wrapper pink">
                      <Layers size={24} />
                    </div>
                    <div className="stat-details">
                      <span className="stat-value">{stats.styleCounts.length}</span>
                      <span className="stat-label">Style Varieties</span>
                    </div>
                  </div>

                  <div className="stat-card green">
                    <div className="stat-icon-wrapper green">
                      <User size={24} />
                    </div>
                    <div className="stat-details">
                      <span className="stat-value" style={{ fontSize: '1rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '140px' }}>
                        {stats.latest ? stats.latest.spotted_by : 'None'}
                      </span>
                      <span className="stat-label">Latest Hunter</span>
                    </div>
                  </div>
                </div>

                <div className="chart-container">
                  {/* Style Distribution Breakdown */}
                  <div className="chart-panel">
                    <h3 className="chart-title">
                      <Layers size={18} color="var(--neon-cyan)" />
                      <span>Art Style Distribution</span>
                    </h3>
                    <div className="chart-bars">
                      {styleBreakdown.map(style => (
                        <div key={style.name} className="chart-bar-row">
                          <div className="chart-bar-info">
                            <span className="chart-bar-name">{style.name}</span>
                            <span className="chart-bar-val">{style.count} ({style.percentage}%)</span>
                          </div>
                          <div className="chart-bar-track">
                            <div 
                              className={`chart-bar-fill ${style.name.replace(' ', '-')}`}
                              style={{ width: `${style.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Latest Artwork Spotlight */}
                  <div className="chart-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 className="chart-title">
                      <Sparkles size={18} color="var(--neon-purple)" />
                      <span>Latest Spotlight</span>
                    </h3>
                    {stats.latest ? (
                      <div className="spotlight-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ height: '180px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-muted)', background: '#111520' }}>
                          <img 
                            src={stats.latest.image_url || '/images/mural.png'} 
                            alt={stats.latest.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        </div>
                        <div>
                          <h4 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>{stats.latest.title}</h4>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0.75rem 0' }}>{stats.latest.description}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`sidebar-card-style style-${stats.latest.style.toLowerCase().replace(' ', '-')}`}>
                              {stats.latest.style}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#5C6C82' }}>Spotted by {stats.latest.spotted_by}</span>
                          </div>
                        </div>
                        <button 
                          className="btn btn-secondary" 
                          style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                          onClick={() => handleSelectReport(stats.latest!)}
                        >
                          <MapIcon size={14} />
                          <span>Show Spotlight</span>
                        </button>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)' }}>No recent activity.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW 4: REPORT FORM */}
        {currentTab === 'report' && (
          <div className="view-panel">
            <h2 className="view-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>Report Street Art</h2>
            
            <form onSubmit={handleSubmit} className="form-panel">
              <div className="form-grid">
                
                {/* Title */}
                <div className="form-group full-width">
                  <label className="form-label">Artwork Title *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Neon Balloon Monkey" 
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group full-width">
                  <label className="form-label">Description / Context</label>
                  <textarea 
                    placeholder="Describe the artwork, background, and spotted details..." 
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Style */}
                <div className="form-group">
                  <label className="form-label">Graffiti Style *</label>
                  <select 
                    className="form-select"
                    value={formData.style}
                    onChange={(e) => setFormData(prev => ({ ...prev, style: e.target.value }))}
                  >
                    <option value="Mural">Mural (Large Painted Wall)</option>
                    <option value="Stencil">Stencil (Spray paint with template)</option>
                    <option value="Piece">Piece (Complex 3D lettering)</option>
                    <option value="Throw-up">Throw-up (Quick bubbled letters)</option>
                    <option value="Tag">Tag (Simple signature scribbled)</option>
                  </select>
                </div>

                {/* Spotted By */}
                <div className="form-group">
                  <label className="form-label">Spotted By (Name) *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. StreetScout" 
                    className="form-input"
                    value={formData.spotted_by}
                    onChange={(e) => setFormData(prev => ({ ...prev, spotted_by: e.target.value }))}
                    required
                  />
                </div>

                {/* Latitude */}
                <div className="form-group">
                  <label className="form-label">Latitude *</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    placeholder="e.g. 40.7042" 
                    className="form-input"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    required
                  />
                </div>

                {/* Longitude */}
                <div className="form-group">
                  <label className="form-label">Longitude *</label>
                  <input 
                    type="number" 
                    step="0.000001" 
                    placeholder="e.g. -73.9234" 
                    className="form-input"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    required
                  />
                </div>

                {/* Pin Location on Map Button */}
                <div className="form-group full-width" style={{ marginTop: '-0.5rem' }}>
                  <button 
                    type="button" 
                    className="form-coordinate-btn"
                    onClick={() => {
                      setCoordinatePickerActive(true);
                      setCurrentTab('map');
                      showToast('Switching to Map. Click anywhere to select coordinates.');
                    }}
                  >
                    <MapIcon size={14} />
                    <span>Select Location Directly on Interactive Map</span>
                  </button>
                </div>

                {/* Image Selection Presets */}
                <div className="form-group full-width">
                  <label className="form-label">Art Photo Preset *</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose one of our premium generated street art photos for this report:</p>
                  
                  <div className="image-presets">
                    {IMAGE_PRESETS.map(preset => (
                      <div 
                        key={preset.id}
                        className={`preset-card ${formData.image_url === preset.path ? 'selected' : ''}`}
                        onClick={() => handlePresetSelect(preset.path)}
                      >
                        <img src={preset.path} alt={preset.label} />
                        <span className="preset-badge">{preset.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom URL Option */}
                <div className="form-group full-width">
                  <label className="form-label">Or Custom Image URL</label>
                  <input 
                    type="url" 
                    placeholder="https://example.com/street-art-image.jpg" 
                    className="form-input"
                    value={formData.image_url.startsWith('/images/') ? '' : formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value || '/images/mural.png' }))}
                  />
                </div>

              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setCurrentTab('map')}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  <PlusCircle size={16} />
                  <span>{isSubmitting ? 'Uploading to Neon...' : 'Save Spotted Art'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}

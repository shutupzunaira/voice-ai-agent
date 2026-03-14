import { useState, useEffect } from "react"
import "../styles/DoctorDashboard.css"

function DoctorDashboard({ doctorName, onLogout }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("all") // all, pending, completed
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/appointments/all")
      if (response.ok) {
        const data = await response.json()
        setAppointments(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error)
      setAppointments([])
    }
    setLoading(false)
  }

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      apt.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.phoneNumber?.includes(searchTerm)

    if (filterStatus === "all") return matchesSearch
    if (filterStatus === "pending") return matchesSearch && apt.status !== "completed"
    if (filterStatus === "completed") return matchesSearch && apt.status === "completed"
    return matchesSearch
  })

  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status !== "completed").length,
    completed: appointments.filter((a) => a.status === "completed").length,
  }

  const handleMarkComplete = (appointmentId) => {
    setAppointments(
      appointments.map((apt) =>
        apt.id === appointmentId ? { ...apt, status: "completed" } : apt
      )
    )
  }

  return (
    <div className="doctor-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>👨‍⚕️ Doctor Dashboard</h1>
          <p>Welcome, Dr. {doctorName}</p>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-container">
        <div className="stat-card total">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Appointments</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      {/* Controls */}
      <div className="dashboard-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search by patient name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterStatus === "pending" ? "active" : ""}`}
            onClick={() => setFilterStatus("pending")}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filterStatus === "completed" ? "active" : ""}`}
            onClick={() => setFilterStatus("completed")}
          >
            Completed
          </button>
        </div>

        <button className="refresh-button" onClick={fetchAppointments}>
          🔄 Refresh
        </button>
      </div>

      {/* Appointments List */}
      <div className="appointments-section">
        <h2>📅 Appointments</h2>

        {loading ? (
          <div className="loading-state">
            <p>Loading appointments...</p>
          </div>
        ) : filteredAppointments.length > 0 ? (
          <div className="appointments-table-container">
            <table className="appointments-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Phone</th>
                  <th>Age</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map((apt) => (
                  <tr key={apt.id} className={`status-${apt.status || "pending"}`}>
                    <td className="patient-name">
                      <strong>{apt.patientName || "N/A"}</strong>
                    </td>
                    <td>{apt.phoneNumber || "N/A"}</td>
                    <td>{apt.patientAge || "N/A"}</td>
                    <td>{apt.date || "N/A"}</td>
                    <td>
                      <span className="time-badge">{apt.time || "N/A"}</span>
                    </td>
                    <td>{apt.reason || "General Consultation"}</td>
                    <td>
                      <span className={`status-badge status-${apt.status || "pending"}`}>
                        {apt.status === "completed" ? "✓ Completed" : "⏳ Pending"}
                      </span>
                    </td>
                    <td className="actions">
                      {apt.status !== "completed" && (
                        <button
                          className="action-btn complete-btn"
                          onClick={() => handleMarkComplete(apt.id)}
                          title="Mark as completed"
                        >
                          ✓ Complete
                        </button>
                      )}
                      <button className="action-btn view-btn" title="View details">
                        👁️ View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>📭 No appointments found</p>
            <p className="empty-subtitle">
              {searchTerm ? "Try a different search term" : "Appointments will appear here"}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
}

export default DoctorDashboard

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
        // The API returns { success, appointments, summary }
        setAppointments(Array.isArray(data?.appointments) ? data.appointments : [])
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error)
      setAppointments([])
    }
    setLoading(false)
  }

  const filteredAppointments = appointments.filter((apt) => {
    const patientName = apt.patientName || apt.name || ""
    const phone = apt.phoneNumber || apt.phone || ""
    const status = apt.status || "pending"

    const matchesSearch =
      patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm)

    if (filterStatus === "all") return matchesSearch
    if (filterStatus === "pending") return matchesSearch && status !== "completed"
    if (filterStatus === "completed") return matchesSearch && status === "completed"
    return matchesSearch
  })

  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => (a.status || "pending") !== "completed").length,
    completed: appointments.filter((a) => (a.status || "pending") === "completed").length,
  }

  const handleMarkComplete = (appointmentId) => {
    setAppointments(
      appointments.map((apt) => {
        const id = apt.appointmentID || apt.id || ""
        return id === appointmentId ? { ...apt, status: "completed" } : apt
      })
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
                {filteredAppointments.map((apt, idx) => {
                  const appointmentId = apt.appointmentID || apt.id || String(idx)
                  const status = apt.status || "pending"
                  const patientName = apt.patientName || apt.name || "N/A"
                  const phone = apt.phoneNumber || apt.phone || "N/A"
                  const age = apt.age || apt.patientAge || "N/A"
                  const date = apt.date || apt.preferredDate || "N/A"
                  const time = apt.time || apt.preferredTime || "N/A"
                  const reason = apt.reason || apt.reasonForVisit || "General Consultation"

                  return (
                    <tr key={appointmentId} className={`status-${status}`}>
                      <td className="patient-name">
                        <strong>{patientName}</strong>
                      </td>
                      <td>{phone}</td>
                      <td>{age}</td>
                      <td>{date}</td>
                      <td>
                        <span className="time-badge">{time}</span>
                      </td>
                      <td>{reason}</td>
                      <td>
                        <span className={`status-badge status-${status}`}>
                          {status === "completed" ? "✓ Completed" : "⏳ Pending"}
                        </span>
                      </td>
                      <td className="actions">
                        {status !== "completed" && (
                          <button
                            className="action-btn complete-btn"
                            onClick={() => handleMarkComplete(appointmentId)}
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
                  )
                })}
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

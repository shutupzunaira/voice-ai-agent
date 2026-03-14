import React from "react"
import "../styles/DatabaseSearchResults.css"

function DatabaseSearchResults({ searchData, type = "symptoms" }) {
  if (!searchData || !searchData.searchPerformed) {
    return null
  }

  return (
    <div className="database-search-container">
      <div className="search-header">
        <span className="search-icon">🔍</span>
        <h4>Database Search Results</h4>
      </div>

      {searchData.appointmentsFound && searchData.appointmentsFound > 0 ? (
        <div className="search-results appointments-results">
          <div className="results-summary">
            <p className="results-count">
              Found {searchData.appointmentsFound} existing appointment{searchData.appointmentsFound !== 1 ? "s" : ""}
            </p>
          </div>
          
          {searchData.foundAppointments && searchData.foundAppointments.length > 0 && (
            <div className="appointments-list">
              {searchData.foundAppointments.map((apt, index) => (
                <div key={index} className="appointment-card">
                  <div className="appointment-header">
                    <span className="appointment-number">{index + 1}</span>
                    <span className="appointment-name">{apt.patientName}</span>
                    <span className={`appointment-status status-${apt.status}`}>{apt.status}</span>
                  </div>
                  <div className="appointment-details">
                    <div className="detail-row">
                      <span className="detail-label">📅 Date:</span>
                      <span className="detail-value">{apt.date}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">🕐 Time:</span>
                      <span className="detail-value">{apt.time}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">👨‍⚕️ Doctor:</span>
                      <span className="detail-value">{apt.doctor}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">📝 Reason:</span>
                      <span className="detail-value">{apt.reason}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="no-results">
          <p>No existing appointments found in database</p>
        </div>
      )}

      {searchData.casesCount && searchData.casesCount > 0 && (
        <div className="search-results cases-results">
          <div className="results-summary">
            <p className="results-count">
              Found {searchData.casesCount} similar medical case{searchData.casesCount !== 1 ? "s" : ""}
            </p>
          </div>

          {searchData.recentCases && searchData.recentCases.length > 0 && (
            <div className="cases-list">
              {searchData.recentCases.map((medCase, index) => (
                <div key={index} className="case-card">
                  <div className="case-header">
                    <span className="case-number">{index + 1}</span>
                    <span className={`case-urgency urgency-${medCase.urgencyLevel.toLowerCase()}`}>
                      {medCase.urgencyLevel}
                    </span>
                  </div>
                  <div className="case-symptoms">
                    <p className="symptoms-label">Symptoms:</p>
                    <p className="symptoms-text">{medCase.symptoms}</p>
                  </div>
                  <div className="case-action">
                    <p className="action-label">Recommended:</p>
                    <p className="action-text">{medCase.recommendedAction}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {searchData.commonUrgencies && Object.keys(searchData.commonUrgencies).length > 0 && (
        <div className="search-results statistics">
          <div className="results-summary">
            <p className="results-title">Common Urgency Classifications</p>
          </div>
          <div className="statistics-grid">
            {Object.entries(searchData.commonUrgencies).map(([urgency, count], index) => (
              <div key={index} className={`stat-item urgency-${urgency.toLowerCase()}`}>
                <span className="stat-urgency">{urgency}</span>
                <span className="stat-count">{count} case{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="search-disclaimer">
        <p>💡 <strong>Note:</strong> These are database search results provided for context. AI answer below is based on your input and this data.</p>
      </div>
    </div>
  )
}

export default DatabaseSearchResults

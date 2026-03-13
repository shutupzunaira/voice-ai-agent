import { useState, useEffect } from "react"
import "../styles/BookingPage.css"

function BookingPage({ onBack }) {
  const [formData, setFormData] = useState({
    patientName: "",
    phoneNumber: "",
    email: "",
    date: "",
    time: "",
    reason: "",
    doctorId: "",
    visitType: "in_person"
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [doctors, setDoctors] = useState([])
  const [clinicHours, setClinicHours] = useState({})
  const [loading, setLoading] = useState(false)
  const [bookingStatus, setBookingStatus] = useState(null)
  const [errors, setErrors] = useState({})

  // Load doctors on component mount
  useEffect(() => {
    loadDoctors()
  }, [])

  // Load available slots when date changes
  useEffect(() => {
    if (formData.date) {
      loadAvailableSlots(formData.date)
    }
  }, [formData.date])

  const loadDoctors = async () => {
    try {
      const response = await fetch('/api/patient/doctors')
      const data = await response.json()
      if (data.success) {
        setDoctors(data.doctors)
        setClinicHours(data.clinicHours)
      }
    } catch (error) {
      console.error('Error loading doctors:', error)
    }
  }

  const loadAvailableSlots = async (date) => {
    try {
      const response = await fetch(`/api/patient/available-slots?date=${date}`)
      const data = await response.json()
      if (data.success) {
        setAvailableSlots(data.availableSlots)
      } else {
        setAvailableSlots([])
        setErrors({ date: data.error })
      }
    } catch (error) {
      console.error('Error loading slots:', error)
      setAvailableSlots([])
      setErrors({ date: 'Failed to load available slots' })
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.patientName.trim()) newErrors.patientName = "Patient name is required"
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required"
    if (!formData.date) newErrors.date = "Appointment date is required"
    if (!formData.time) newErrors.time = "Appointment time is required"
    if (!formData.reason.trim()) newErrors.reason = "Reason for visit is required"

    // Email validation (optional field)
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setBookingStatus(null)

    try {
      const response = await fetch('/api/patient/book-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setBookingStatus({
          type: 'success',
          message: data.message,
          appointment: data.appointment,
          clinicInfo: data.clinicInfo
        })
        // Reset form
        setFormData({
          patientName: "",
          phoneNumber: "",
          email: "",
          date: "",
          time: "",
          reason: "",
          doctorId: "",
          visitType: "in_person"
        })
        setAvailableSlots([])
      } else {
        setBookingStatus({
          type: 'error',
          message: data.error
        })
      }
    } catch (error) {
      console.error('Booking error:', error)
      setBookingStatus({
        type: 'error',
        message: 'Failed to book appointment. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  const getMinDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  return (
    <div className="booking-page">
      <div className="home-header">
        <div className="hospital-icon">📅</div>
        <h1>Book Appointment</h1>
        <p>Schedule your visit with our healthcare professionals</p>
      </div>

      <div className="booking-container">
        <form onSubmit={handleSubmit} className="booking-form">
          <div className="form-section">
            <h3>Patient Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="patientName">Full Name *</label>
                <input
                  type="text"
                  id="patientName"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  className={errors.patientName ? 'error' : ''}
                  placeholder="Enter your full name"
                />
                {errors.patientName && <span className="error-message">{errors.patientName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number *</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className={errors.phoneNumber ? 'error' : ''}
                  placeholder="(555) 123-4567"
                />
                {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email (Optional)</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? 'error' : ''}
                placeholder="your.email@example.com"
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
          </div>

          <div className="form-section">
            <h3>Appointment Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">Preferred Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={getMinDate()}
                  className={errors.date ? 'error' : ''}
                />
                {errors.date && <span className="error-message">{errors.date}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="time">Preferred Time *</label>
                <select
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  className={errors.time ? 'error' : ''}
                  disabled={!formData.date || availableSlots.length === 0}
                >
                  <option value="">Select a time</option>
                  {availableSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                {errors.time && <span className="error-message">{errors.time}</span>}
                {!formData.date && <span className="help-text">Please select a date first</span>}
                {formData.date && availableSlots.length === 0 && !errors.date && (
                  <span className="help-text">No slots available for this date</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="doctorId">Preferred Doctor</label>
                <select
                  id="doctorId"
                  name="doctorId"
                  value={formData.doctorId}
                  onChange={handleInputChange}
                >
                  <option value="">Any available doctor</option>
                  {doctors.filter(doc => doc.available).map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="visitType">Visit Type</label>
                <select
                  id="visitType"
                  name="visitType"
                  value={formData.visitType}
                  onChange={handleInputChange}
                >
                  <option value="in_person">In-Person Visit</option>
                  <option value="telemedicine">Telemedicine</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Visit *</label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className={errors.reason ? 'error' : ''}
                placeholder="Please describe your symptoms or reason for the appointment"
                rows="4"
              />
              {errors.reason && <span className="error-message">{errors.reason}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onBack} className="back-button">
              ← Back to Home
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>

        {bookingStatus && (
          <div className={`booking-status ${bookingStatus.type}`}>
            <h3>{bookingStatus.type === 'success' ? '✅ Booking Confirmed!' : '❌ Booking Failed'}</h3>
            <p>{bookingStatus.message}</p>

            {bookingStatus.type === 'success' && bookingStatus.appointment && (
              <div className="appointment-details">
                <h4>Appointment Details</h4>
                <div className="detail-grid">
                  <div><strong>Appointment ID:</strong> {bookingStatus.appointment.id}</div>
                  <div><strong>Date & Time:</strong> {bookingStatus.appointment.date} at {bookingStatus.appointment.time}</div>
                  <div><strong>Doctor:</strong> {bookingStatus.appointment.doctor.name} ({bookingStatus.appointment.doctor.specialty})</div>
                  <div><strong>Visit Type:</strong> {bookingStatus.appointment.visitType === 'in_person' ? 'In-Person' : 'Telemedicine'}</div>
                  <div><strong>Status:</strong> {bookingStatus.appointment.status}</div>
                </div>
                <div className="confirmation-message">
                  <p>{bookingStatus.appointment.confirmationMessage}</p>
                </div>
                {bookingStatus.clinicInfo && (
                  <div className="clinic-info">
                    <h4>Clinic Information</h4>
                    <p><strong>Address:</strong> {bookingStatus.clinicInfo.address}</p>
                    <p><strong>Phone:</strong> {bookingStatus.clinicInfo.phone}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="clinic-hours">
          <h3>Clinic Hours</h3>
          <div className="hours-grid">
            {Object.entries(clinicHours).map(([day, hours]) => (
              <div key={day} className="hours-item">
                <span className="day">{day.charAt(0).toUpperCase() + day.slice(1)}:</span>
                <span className="hours">{hours}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingPage
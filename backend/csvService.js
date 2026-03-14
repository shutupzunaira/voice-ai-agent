import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if it doesn't exist
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
  console.log("✅ Created data directory for local storage");
}

const PATIENTS_CSV = path.join(DATA_DIR, "patients.csv");
const APPOINTMENTS_CSV = path.join(DATA_DIR, "appointments.csv");
const CONVERSATIONS_CSV = path.join(DATA_DIR, "conversations.csv");

/* ─────────────── CSV Headers ─────────────── */
const PATIENTS_HEADER = "id,timestamp,symptoms,urgencyLevel,recommendedAction,aiResponse\n";
const APPOINTMENTS_HEADER = "id,userId,patientName,phoneNumber,email,doctorSpecialization,preferredDate,preferredTime,reasonForVisit,status,bookingMethod,createdAt,updatedAt\n";
const CONVERSATIONS_HEADER = "id,userId,role,message,timestamp,appointmentContext\n";

/* ─────────────── Initialize CSV Files ─────────────── */
function initializeCSVFiles() {
  try {
    // Initialize patients.csv
    if (!fs.existsSync(PATIENTS_CSV)) {
      fs.writeFileSync(PATIENTS_CSV, PATIENTS_HEADER, "utf8");
      console.log("✅ Initialized patients.csv");
    }

    // Initialize appointments.csv
    if (!fs.existsSync(APPOINTMENTS_CSV)) {
      fs.writeFileSync(APPOINTMENTS_CSV, APPOINTMENTS_HEADER, "utf8");
      console.log("✅ Initialized appointments.csv");
    }

    // Initialize conversations.csv
    if (!fs.existsSync(CONVERSATIONS_CSV)) {
      fs.writeFileSync(CONVERSATIONS_CSV, CONVERSATIONS_HEADER, "utf8");
      console.log("✅ Initialized conversations.csv");
    }
  } catch (error) {
    console.error("❌ Error initializing CSV files:", error);
  }
}

/* ─────────────── Utility: Escape CSV values ─────────────── */
function escapeCSVValue(value) {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

/* ─────────────── Utility: Parse CSV Line ─────────────── */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/* ─────────────── Read CSV as Array of Objects ─────────────── */
function readCSV(filePath, headers) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(line => line.trim());

    if (lines.length <= 1) {
      return [];
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || "";
      });
      data.push(obj);
    }

    return data;
  } catch (error) {
    console.error("❌ Error reading CSV:", error);
    return [];
  }
}

/* ─────────────── Save Patient to CSV ─────────────── */
export async function savePatientToCSV(symptoms, aiResponse, urgencyLevel, recommendedAction) {
  try {
    const id = "patient_" + Date.now();
    const timestamp = new Date().toISOString();

    const row = [
      id,
      timestamp,
      escapeCSVValue(symptoms),
      urgencyLevel,
      escapeCSVValue(recommendedAction),
      escapeCSVValue(aiResponse)
    ].join(",") + "\n";

    fs.appendFileSync(PATIENTS_CSV, row, "utf8");
    console.log("✅ Patient data saved to CSV with ID:", id);
    return id;
  } catch (error) {
    console.error("❌ Error saving patient to CSV:", error);
    throw error;
  }
}

/* ─────────────── Save Appointment to CSV (or Update if Exists) ─────────────── */
export async function saveAppointmentToCSV(userId, appointmentData, bookingMethod = "ai") {
  try {
    const now = new Date().toISOString();
    
    // Read existing appointments to check for duplicates
    const appointments = await getAllAppointmentsFromCSV();
    
    // Check if this appointment already exists for the same user/patient/date/time
    const existingIndex = appointments.findIndex(apt => 
      apt.userId === userId && 
      apt.patientName.toLowerCase() === (appointmentData.patientName || "").toLowerCase() &&
      apt.preferredDate === appointmentData.preferredDate &&
      apt.preferredTime === appointmentData.preferredTime
    );

    const id = existingIndex >= 0 ? appointments[existingIndex].id : "apt_" + Date.now();
    
    const row = [
      id,
      userId,
      escapeCSVValue(appointmentData.patientName || ""),
      escapeCSVValue(appointmentData.phoneNumber || ""),
      escapeCSVValue(appointmentData.email || ""),
      escapeCSVValue(appointmentData.doctorSpecialization || ""),
      appointmentData.preferredDate || "",
      appointmentData.preferredTime || "",
      escapeCSVValue(appointmentData.reasonForVisit || ""),
      appointmentData.status || "pending",
      bookingMethod, // "ai" or "form"
      existingIndex >= 0 ? appointments[existingIndex].createdAt : now, // Keep original creation date
      now // Always update the updatedAt timestamp
    ].join(",") + "\n";

    // If updating, remove the old entry first
    if (existingIndex >= 0) {
      const content = fs.readFileSync(APPOINTMENTS_CSV, "utf8");
      const lines = content.split("\n");
      const headerLine = lines[0];
      const dataLines = lines.slice(1).filter((line, index) => index !== existingIndex);
      fs.writeFileSync(APPOINTMENTS_CSV, headerLine + dataLines.join("\n"), "utf8");
      console.log("🔄 Appointment updated in CSV with ID:", id);
    } else {
      fs.appendFileSync(APPOINTMENTS_CSV, row, "utf8");
      console.log("✅ New appointment saved to CSV with ID:", id);
    }

    return id;
  } catch (error) {
    console.error("❌ Error saving appointment to CSV:", error);
    throw error;
  }
}

/* ─────────────── Save Conversation to CSV ─────────────── */
export async function saveConversationToCSV(userId, role, message, appointmentContext = null) {
  try {
    const id = "conv_" + Date.now();
    const timestamp = new Date().toISOString();

    const row = [
      id,
      userId,
      role,
      escapeCSVValue(message),
      timestamp,
      escapeCSVValue(appointmentContext ? JSON.stringify(appointmentContext) : "")
    ].join(",") + "\n";

    fs.appendFileSync(CONVERSATIONS_CSV, row, "utf8");
    console.log("✅ Conversation saved to CSV with ID:", id);
    return id;
  } catch (error) {
    console.error("❌ Error saving conversation to CSV:", error);
    throw error;
  }
}

/* ─────────────── Get All Patients from CSV ─────────────── */
export async function getAllPatientsFromCSV() {
  try {
    const headers = ["id", "timestamp", "symptoms", "urgencyLevel", "recommendedAction", "aiResponse"];
    return readCSV(PATIENTS_CSV, headers);
  } catch (error) {
    console.error("❌ Error getting patients from CSV:", error);
    return [];
  }
}

/* ─────────────── Search Patients by Symptoms ─────────────── */
export async function searchPatientsInCSV(symptomKeywords) {
  try {
    const patients = await getAllPatientsFromCSV();
    const keywords = symptomKeywords.toLowerCase().split(" ");
    const matches = [];

    patients.forEach(patient => {
      const symptoms = patient.symptoms.toLowerCase();
      const matchCount = keywords.filter(keyword => symptoms.includes(keyword)).length;

      if (matchCount > 0) {
        matches.push({
          ...patient,
          matchScore: matchCount / keywords.length
        });
      }
    });

    // Sort by relevance and recency
    return matches.sort((a, b) => b.matchScore - a.matchScore || new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error("❌ Error searching patients in CSV:", error);
    return [];
  }
}

/* ─────────────── Get All Appointments from CSV ─────────────── */
export async function getAllAppointmentsFromCSV() {
  try {
    const headers = [
      "id",
      "userId",
      "patientName",
      "phoneNumber",
      "email",
      "doctorSpecialization",
      "preferredDate",
      "preferredTime",
      "reasonForVisit",
      "status",
      "bookingMethod",
      "createdAt",
      "updatedAt"
    ];
    return readCSV(APPOINTMENTS_CSV, headers);
  } catch (error) {
    console.error("❌ Error getting appointments from CSV:", error);
    return [];
  }
}

/* ─────────────── Search Appointments ─────────────── */
export async function searchAppointmentsInCSV(searchTerm) {
  try {
    const appointments = await getAllAppointmentsFromCSV();
    const lowerSearch = searchTerm.toLowerCase();

    const matches = appointments.filter(apt =>
      apt.patientName.toLowerCase().includes(lowerSearch) ||
      apt.phoneNumber.includes(searchTerm) ||
      apt.reasonForVisit.toLowerCase().includes(lowerSearch)
    );

    // Sort by most recent
    return matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error("❌ Error searching appointments in CSV:", error);
    return [];
  }
}

/* ─────────────── Get User's Appointments from CSV ─────────────── */
export async function getUserAppointmentsFromCSV(userId) {
  try {
    const appointments = await getAllAppointmentsFromCSV();
    return appointments.filter(apt => apt.userId === userId);
  } catch (error) {
    console.error("❌ Error getting user appointments from CSV:", error);
    return [];
  }
}

/* ─────────────── Compare Patient Data ─────────────── */
export async function comparePatientData(newSymptoms) {
  try {
    const existingPatients = await searchPatientsInCSV(newSymptoms);
    
    return {
      foundSimilar: existingPatients.length > 0,
      similarCases: existingPatients.slice(0, 5), // Return top 5 matches
      totalMatches: existingPatients.length,
      recommendedActions: [...new Set(existingPatients.map(p => p.recommendedAction))],
      commonUrgencyLevels: getCounts(existingPatients.map(p => p.urgencyLevel))
    };
  } catch (error) {
    console.error("❌ Error comparing patient data:", error);
    return { foundSimilar: false, similarCases: [] };
  }
}

/* ─────────────── Compare Appointment Data ─────────────── */
export async function compareAppointmentData(phoneNumber) {
  try {
    const existingAppointments = await searchAppointmentsInCSV(phoneNumber);
    
    return {
      foundExisting: existingAppointments.length > 0,
      existingAppointments: existingAppointments.slice(0, 5),
      totalCount: existingAppointments.length,
      lastAppointment: existingAppointments[0] || null,
      statuses: getCounts(existingAppointments.map(a => a.status))
    };
  } catch (error) {
    console.error("❌ Error comparing appointment data:", error);
    return { foundExisting: false, existingAppointments: [] };
  }
}

/* ─────────────── Get Statistics ─────────────── */
export async function getDataStatistics() {
  try {
    const patients = await getAllPatientsFromCSV();
    const appointments = await getAllAppointmentsFromCSV();
    const conversations = readCSV(CONVERSATIONS_CSV, ["id", "userId", "role", "message", "timestamp", "appointmentContext"]);

    return {
      totalPatients: patients.length,
      totalAppointments: appointments.length,
      totalConversations: conversations.length,
      urgencyDistribution: getCounts(patients.map(p => p.urgencyLevel)),
      appointmentStatuses: getCounts(appointments.map(a => a.status)),
      lastPatient: patients[patients.length - 1] || null,
      lastAppointment: appointments[appointments.length - 1] || null
    };
  } catch (error) {
    console.error("❌ Error getting statistics:", error);
    return {};
  }
}

/* ─────────────── Helper: Count Occurrences ─────────────── */
function getCounts(array) {
  const counts = {};
  array.forEach(item => {
    if (item) {
      counts[item] = (counts[item] || 0) + 1;
    }
  });
  return counts;
}

/* ─────────────── Export Statistics as JSON ─────────────── */
export async function exportDataAsJSON() {
  try {
    const patients = await getAllPatientsFromCSV();
    const appointments = await getAllAppointmentsFromCSV();
    const conversations = readCSV(CONVERSATIONS_CSV, ["id", "userId", "role", "message", "timestamp", "appointmentContext"]);
    const stats = await getDataStatistics();

    const exportData = {
      exportDate: new Date().toISOString(),
      statistics: stats,
      patients,
      appointments,
      conversations
    };

    const exportPath = path.join(DATA_DIR, `export_${Date.now()}.json`);
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), "utf8");
    console.log("✅ Data exported to JSON:", exportPath);
    return exportPath;
  } catch (error) {
    console.error("❌ Error exporting data:", error);
    throw error;
  }
}

/* ─────────────── Initialize on Import ─────────────── */
initializeCSVFiles();

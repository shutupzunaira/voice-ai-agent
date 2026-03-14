import { collection, addDoc, query, where, getDocs, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase.js";

/* ─────────────── Patient Triage Data ─────────────── */
export async function savePatient(symptoms, aiResponse, urgencyLevel = null, recommendedAction = null) {
  try {
    const patientData = {
      symptoms: symptoms,
      aiResponse: aiResponse,
      timestamp: new Date()
    };

    if (urgencyLevel) {
      patientData.urgencyLevel = urgencyLevel;
    }
    if (recommendedAction) {
      patientData.recommendedAction = recommendedAction;
    }

    const docRef = await addDoc(collection(db, "patients"), patientData);

    console.log("Patient saved with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving patient:", error);
    throw error;
  }
}

/* ─────────────── AI Appointment Booking ─────────────── */

/**
 * Get or create user profile for appointment booking
 */
export async function getUserProfile(userIdentifier) {
  try {
    // Search by phone number or email
    const q = query(
      collection(db, "users"),
      where("contact", "==", userIdentifier)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        userId: doc.id,
        ...doc.data()
      };
    } else {
      // Create new user profile
      const userRef = await addDoc(collection(db, "users"), {
        contact: userIdentifier,
        appointments: [],
        conversationHistory: [],
        createdAt: new Date()
      });

      return {
        userId: userRef.id,
        contact: userIdentifier,
        appointments: [],
        conversationHistory: [],
        createdAt: new Date()
      };
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

/**
 * Save appointment with full details
 */
export async function saveAppointment(userId, appointmentData) {
  try {
    // Build appointment object with only provided fields (no undefined values)
    const appointment = {
      patientName: appointmentData.patientName || "Unknown",
      phoneNumber: appointmentData.phoneNumber || "N/A",
      email: appointmentData.email || "N/A",
      doctorSpecialization: appointmentData.doctorSpecialization || "General",
      doctorName: appointmentData.doctorName || "Available Doctor",
      preferredDate: appointmentData.preferredDate || new Date().toISOString().split('T')[0],
      preferredTime: appointmentData.preferredTime || "09:00",
      reasonForVisit: appointmentData.reasonForVisit || "General consultation",
      ageGroup: appointmentData.ageGroup || "Not specified",
      status: appointmentData.status || "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      conversationSummary: appointmentData.conversationSummary || ""
    };

    // Save appointment directly to appointments collection instead of as nested array
    const appointmentRef = await addDoc(collection(db, "appointments"), appointment);
    
    console.log("✅ Appointment saved to Firestore with ID:", appointmentRef.id);
    return {
      id: appointmentRef.id,
      ...appointment
    };
  } catch (error) {
    console.error("Error saving appointment:", error);
    throw error;
  }
}

/**
 * Update appointment by modifying user's appointment array
 */
export async function updateAppointment(userId, appointmentIndex, updatedData) {
  try {
    const userRef = doc(db, "users", userId);
    
    // Get current user data
    const q = query(collection(db, "users"), where("contact", "==", (await getUserProfile(userId)).contact));
    const userSnapshot = await getDocs(q);
    
    if (userSnapshot.empty) {
      throw new Error("User not found");
    }

    const userData = userSnapshot.docs[0].data();
    const appointments = JSON.parse(JSON.stringify(userData.appointments || []));

    if (appointmentIndex >= appointments.length) {
      throw new Error("Appointment index out of bounds");
    }

    // Update the specific appointment
    appointments[appointmentIndex] = {
      ...appointments[appointmentIndex],
      ...updatedData,
      updatedAt: new Date()
    };

    await updateDoc(userRef, {
      appointments: appointments
    });

    console.log("Appointment updated at index:", appointmentIndex);
    return appointments[appointmentIndex];
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw error;
  }
}

/**
 * Update appointment by patient name (for voice assessment portal)
 */
export async function updateAppointmentByName(userId, patientName, updatedData) {
  try {
    const userRef = doc(db, "users", userId);
    
    // Get current user data
    const userSnapshot = await getDocs(query(collection(db, "users"), where("contact", "==", (await getUserProfile(userId)).contact)));
    
    if (userSnapshot.empty) {
      throw new Error("User not found");
    }

    const userData = userSnapshot.docs[0].data();
    const appointments = JSON.parse(JSON.stringify(userData.appointments || []));

    // Find appointment with matching patient name
    const appointmentIndex = appointments.findIndex(apt => apt.patientName.toLowerCase() === patientName.toLowerCase());
    
    if (appointmentIndex === -1) {
      throw new Error(`No appointment found for patient: ${patientName}`);
    }

    // Update the specific appointment
    appointments[appointmentIndex] = {
      ...appointments[appointmentIndex],
      ...updatedData,
      updatedAt: new Date()
    };

    await updateDoc(userRef, {
      appointments: appointments
    });

    console.log("Appointment updated for patient:", patientName);
    return {
      foundAppointment: appointments[appointmentIndex],
      appointmentIndex: appointmentIndex,
      totalAppointments: appointments.length
    };
  } catch (error) {
    console.error("Error updating appointment by name:", error);
    throw error;
  }
}

/**
 * Get user's latest appointment (for context in updates)
 */
export async function getLatestAppointment(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const docSnapshot = await getDocs(query(collection(db, "users"), where("contact", "==", (await getUserProfile(userId)).contact)));

    if (docSnapshot.empty) {
      return null;
    }

    const userData = docSnapshot.docs[0].data();
    const appointments = userData.appointments || [];

    if (appointments.length === 0) {
      return null;
    }

    // Return the most recently updated appointment
    return appointments[appointments.length - 1];
  } catch (error) {
    console.error("Error getting latest appointment:", error);
    throw error;
  }
}

/**
 * Get all user appointments
 */
export async function getAllAppointments(userId) {
  try {
    const userSnapshot = await getDocs(query(collection(db, "users"), where("contact", "==", (await getUserProfile(userId)).contact)));

    if (userSnapshot.empty) {
      return [];
    }

    const userData = userSnapshot.docs[0].data();
    return userData.appointments || [];
  } catch (error) {
    console.error("Error getting all appointments:", error);
    throw error;
  }
}

/**
 * Save conversation summary for context
 */
export async function addConversationEntry(userId, role, message, appointmentContext = null) {
  try {
    const conversationEntry = {
      role: role, // "user" or "assistant"
      message: message,
      timestamp: new Date(),
      appointmentContext: appointmentContext
    };

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      conversationHistory: arrayUnion(conversationEntry)
    });

    console.log("Conversation entry saved");
  } catch (error) {
    console.error("Error saving conversation entry:", error);
    throw error;
  }
}

/* ─────────────── Database Search Functions ─────────────── */

/**
 * Search patient triage history by symptoms
 */
export async function searchPatientsBySymptoms(symptomKeywords) {
  try {
    const allPatients = await getDocs(collection(db, "patients"));
    const matches = [];

    allPatients.forEach(doc => {
      const data = doc.data();
      const symptoms = data.symptoms?.toLowerCase() || "";
      const keywords = symptomKeywords.toLowerCase().split(" ");
      
      const matchCount = keywords.filter(keyword => symptoms.includes(keyword)).length;
      
      if (matchCount > 0) {
        matches.push({
          id: doc.id,
          ...data,
          matchScore: matchCount / keywords.length
        });
      }
    });

    // Sort by most recent and relevance
    return matches.sort((a, b) => b.matchScore - a.matchScore || new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error("Error searching patients:", error);
    return [];
  }
}

/**
 * Search appointments by patient name or phone
 */
export async function searchAppointments(searchTerm) {
  try {
    const allUsers = await getDocs(collection(db, "users"));
    const matches = [];

    allUsers.forEach(userDoc => {
      const userData = userDoc.data();
      const appointments = userData.appointments || [];
      
      appointments.forEach(apt => {
        const nameMatch = apt.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
        const phoneMatch = apt.phoneNumber?.includes(searchTerm);
        
        if (nameMatch || phoneMatch) {
          matches.push({
            userId: userDoc.id,
            ...apt,
            userContact: userData.contact
          });
        }
      });
    });

    // Sort by most recent
    return matches.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (error) {
    console.error("Error searching appointments:", error);
    return [];
  }
}

/**
 * Get relevant medical history for symptoms
 */
export async function getMedicalHistory(keywords) {
  try {
    const patientMatches = await searchPatientsBySymptoms(keywords);
    
    // Extract unique urgency levels and recommendations
    const history = {
      recentCases: patientMatches.slice(0, 5),
      commonUrgencies: {},
      recommendations: new Set()
    };

    patientMatches.forEach(patient => {
      if (patient.urgencyLevel) {
        history.commonUrgencies[patient.urgencyLevel] = (history.commonUrgencies[patient.urgencyLevel] || 0) + 1;
      }
      if (patient.recommendedAction) {
        history.recommendations.add(patient.recommendedAction);
      }
    });

    return {
      ...history,
      recommendations: Array.from(history.recommendations)
    };
  } catch (error) {
    console.error("Error getting medical history:", error);
    return { recentCases: [], commonUrgencies: {}, recommendations: [] };
  }
}

/* ─────────────── Voice AI Speech Collection ─────────────── */

/**
 * Save complete patient profile with personal information collected through voice
 */
export async function saveCompletePatientProfile(patientInfo) {
  try {
    const profile = {
      // Personal Information
      name: patientInfo.name || "Unknown",
      phoneNumber: patientInfo.phoneNumber || "N/A",
      email: patientInfo.email || "N/A",
      age: patientInfo.age || "Not specified",
      ageGroup: patientInfo.ageGroup || "Not specified",
      gender: patientInfo.gender || "Not specified",
      
      // Medical Information
      symptoms: patientInfo.symptoms || "",
      chiefComplaint: patientInfo.chiefComplaint || "",
      medicalHistory: patientInfo.medicalHistory || [],
      currentMedications: patientInfo.currentMedications || [],
      allergies: patientInfo.allergies || [],
      
      // Triage Assessment
      urgencyLevel: patientInfo.urgencyLevel || "general",
      triageMode: patientInfo.triageMode || "general",
      riskFactors: patientInfo.riskFactors || [],
      
      // Metadata
      sessionId: patientInfo.sessionId || "",
      sourceType: "voice_ai",
      createdAt: new Date(),
      updatedAt: new Date(),
      conversationLength: patientInfo.conversationLength || 0
    };

    const patientRef = await addDoc(collection(db, "patients"), profile);
    
    console.log("✅ Complete patient profile saved to Firestore with ID:", patientRef.id);
    return {
      patientId: patientRef.id,
      ...profile
    };
  } catch (error) {
    console.error("Error saving complete patient profile:", error);
    throw error;
  }
}

/**
 * Save voice conversation entries to Firestore
 */
export async function saveConversationEntry(sessionId, patientId, role, message, metadata = {}) {
  try {
    const entry = {
      sessionId: sessionId,
      patientId: patientId,
      role: role, // "user" or "assistant"
      message: message,
      messageType: metadata.messageType || "text",
      timestamp: new Date(),
      duration: metadata.duration || null, // for voice messages
      audioUrl: metadata.audioUrl || null,
      confidence: metadata.confidence || null, // STT confidence
      ...metadata
    };

    const conversationRef = await addDoc(collection(db, "conversations"), entry);
    
    console.log(`✅ Conversation entry saved (${role}): ${conversationRef.id}`);
    return {
      entryId: conversationRef.id,
      ...entry
    };
  } catch (error) {
    console.error("Error saving conversation entry:", error);
    throw error;
  }
}

/**
 * Save triage assessment results to Firestore
 */
export async function saveTriageAssessment(patientId, assessmentData) {
  try {
    const assessment = {
      patientId: patientId,
      sessionId: assessmentData.sessionId || "",
      mode: assessmentData.mode || "general",
      
      // Assessment Results
      symptoms: assessmentData.symptoms || [],
      urgencyLevel: assessmentData.urgencyLevel || "general",
      recommendedAction: assessmentData.recommendedAction || "",
      riskFactors: assessmentData.riskFactors || [],
      redFlags: assessmentData.redFlags || [],
      
      // Vital Indicators
      pregnant: assessmentData.pregnant || false,
      recentInjury: assessmentData.recentInjury || false,
      heavyBleeding: assessmentData.heavyBleeding || false,
      respiratoryDistress: assessmentData.respiratoryDistress || false,
      severeChestPain: assessmentData.severeChestPain || false,
      
      // Assessment Summary
      assessmentSummary: assessmentData.assessmentSummary || "",
      recommendations: assessmentData.recommendations || [],
      followUpRequired: assessmentData.followUpRequired || false,
      
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const assessmentRef = await addDoc(collection(db, "triage_assessments"), assessment);
    
    console.log("✅ Triage assessment saved to Firestore with ID:", assessmentRef.id);
    return {
      assessmentId: assessmentRef.id,
      ...assessment
    };
  } catch (error) {
    console.error("Error saving triage assessment:", error);
    throw error;
  }
}

/**
 * Save complete voice session with all collected data
 */
export async function saveVoiceSession(sessionData) {
  try {
    const session = {
      sessionId: sessionData.sessionId || "",
      patientId: sessionData.patientId || "",
      
      // Session Info
      mode: sessionData.mode || "general",
      startTime: sessionData.startTime || new Date(),
      endTime: sessionData.endTime || new Date(),
      duration: sessionData.duration || 0,
      
      // Patient Data
      patientName: sessionData.patientName || "Unknown",
      phoneNumber: sessionData.phoneNumber || "N/A",
      
      // Conversation Statistics
      totalMessages: sessionData.totalMessages || 0,
      userMessages: sessionData.userMessages || 0,
      aiMessages: sessionData.aiMessages || 0,
      
      // Assessment Results
      urgencyLevel: sessionData.urgencyLevel || "general",
      appointmentBooked: sessionData.appointmentBooked || false,
      appointmentDetails: sessionData.appointmentDetails || null,
      
      // Metadata
      language: sessionData.language || "en",
      sourceType: "voice_ai",
      status: sessionData.status || "completed",
      notes: sessionData.notes || ""
    };

    const sessionRef = await addDoc(collection(db, "voice_sessions"), session);
    
    console.log("✅ Voice session saved to Firestore with ID:", sessionRef.id);
    return {
      voiceSessionId: sessionRef.id,
      ...session
    };
  } catch (error) {
    console.error("Error saving voice session:", error);
    throw error;
  }
}

/**
 * Get all booked appointments from Firestore appointments collection
 */
export async function getAllAppointmentsFromFirestore() {
  try {
    const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
    const appointments = [];

    appointmentsSnapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      });
    });

    // Sort by date and time
    appointments.sort((a, b) => {
      const dateA = new Date(`${a.preferredDate} ${a.preferredTime}`);
      const dateB = new Date(`${b.preferredDate} ${b.preferredTime}`);
      return dateA - dateB;
    });

    console.log("✅ Retrieved", appointments.length, "appointments from Firestore");
    return appointments;
  } catch (error) {
    console.error("Error getting appointments from Firestore:", error);
    return [];
  }
}
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getMyAppointments, getServices, getSlots } from "../services/api";

const SUGGESTIONS = [
  { label: "Services", ask: "Quels services sont disponibles ?" },
  { label: "Creneaux", ask: "Quels creneaux sont disponibles ?" },
  { label: "Mes RDV", ask: "Montre mes RDV" },
  { label: "Scanner", ask: "Comment scanner ma carte grise ?" },
];

const QUICK_BY_ROUTE = {
  "/": [
    { label: "OTP", ask: "Comment fonctionne le code OTP ?" },
    { label: "Inscription", to: "/register" },
  ],
  "/book": [
    { label: "Creneaux", ask: "Quels creneaux sont disponibles ?" },
    { label: "Scanner", to: "/ocr" },
  ],
  "/ocr": [
    { label: "Aide scan", ask: "Comment scanner ma carte grise ?" },
    { label: "RDV", to: "/book" },
  ],
  "/admin-dashboard": [
    { label: "Admin", ask: "Que peut faire l'admin ?" },
    { label: "Services", ask: "Quels services sont disponibles ?" },
  ],
};

function hasToken() {
  return Boolean(localStorage.getItem("token"));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function todayIso(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

function formatDate(value) {
  return value ? value.split("T")[0] : "-";
}

function statusLabel(status) {
  if (status === "approved") return "approuve";
  if (status === "rejected") return "refuse";
  if (status === "cancelled") return "annule";
  return "en attente";
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getInitialMessages(user) {
  const name = user.email || user.username || "client";

  return [
    {
      from: "bot",
      title: "Assistant Hyundai RDV",
      text: hasToken()
        ? `Bonjour ${name}. Je peux vous aider a reserver, scanner votre carte grise, suivre vos RDV et verifier les disponibilites.`
        : "Bonjour. Je peux vous guider pour la connexion, l'inscription, l'OTP, les services et la prise de rendez-vous.",
      actions: SUGGESTIONS,
    },
  ];
}

function staticAnswer(message, user) {
  const text = normalizeText(message);

  if (text.includes("ocr") || text.includes("scan") || text.includes("carte grise")) {
    return {
      title: "Scan carte grise",
      text:
        "Ouvrez Scanner vehicule, importez une photo nette de la carte grise, puis lancez OCR. Verifiez toujours le modele et la plaque avant de les envoyer vers la prise de RDV.",
      actions: [
        { label: "Ouvrir scanner", to: "/ocr" },
        { label: "Prendre RDV", to: "/book" },
      ],
    };
  }

  if (text.includes("otp") || text.includes("code") || text.includes("email")) {
    return {
      title: "Verification OTP",
      text:
        "Apres la connexion client, un code OTP a 6 chiffres est envoye par email. Entrez-le dans l'ecran OTP. Si le code expire ou n'arrive pas, utilisez Renvoyer le code.",
      actions: [{ label: "Ecran OTP", to: "/otp-login" }],
    };
  }

  if (text.includes("payer") || text.includes("paiement") || text.includes("carte")) {
    return {
      title: "Paiement",
      text:
        "Apres la creation du RDV, l'application ouvre l'etape paiement. Le paiement carte/mobile est simule pour la demo; le paiement sur place reste suivi en attente.",
      actions: [{ label: "Prendre RDV", to: "/book" }],
    };
  }

  if (text.includes("admin") || text.includes("approuver") || text.includes("refuser")) {
    if (user.role !== "admin") {
      return {
        title: "Acces admin",
        text:
          "Le dashboard admin est reserve aux comptes avec le role admin. Les clients peuvent suivre leurs propres RDV depuis l'espace client.",
      };
    }

    return {
      title: "Dashboard admin",
      text:
        "L'admin peut valider ou refuser les RDV, gerer les services, organiser les creneaux, consulter les comptes et suivre les paiements.",
      actions: [{ label: "Dashboard admin", to: "/admin-dashboard" }],
    };
  }

  if (text.includes("compte") || text.includes("inscription")) {
    return {
      title: "Creation de compte",
      text:
        "Creez un compte client depuis Inscription. Le compte est cree dans Keycloak, puis la connexion demande une verification OTP par email.",
      actions: [{ label: "Inscription", to: "/register" }],
    };
  }

  if (text.includes("deconnexion") || text.includes("logout")) {
    return {
      title: "Deconnexion",
      text: "Utilisez le bouton Deconnexion dans le menu du dashboard pour fermer votre session.",
    };
  }

  return null;
}

export default function Chatbot() {
  const navigate = useNavigate();
  const location = useLocation();
  const bodyRef = useRef(null);
  const user = getUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => getInitialMessages(user));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const quickActions = useMemo(() => {
    const routeActions = QUICK_BY_ROUTE[location.pathname] || [];
    return [...routeActions, ...SUGGESTIONS].slice(0, 4);
  }, [location.pathname]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const addMessages = (...nextMessages) => {
    setMessages((current) => [...current, ...nextMessages]);
  };

  const sendBot = (text, actions = [], title = "") => {
    addMessages({ from: "bot", title, text, actions });
  };

  const requireLogin = (subject) => {
    sendBot(`Connectez-vous d'abord pour consulter ${subject}.`, [
      { label: "Connexion", to: "/" },
      { label: "Inscription", to: "/register" },
    ]);
  };

  const answerWithServices = async () => {
    if (!hasToken()) {
      requireLogin("les services disponibles");
      return;
    }

    const data = await getServices(getUser().role === "admin");

    if (!data.success) {
      sendBot(data.message || "Impossible de charger les services pour le moment.");
      return;
    }

    const services = data.services || [];

    if (services.length === 0) {
      sendBot("Aucun service actif n'est disponible actuellement.");
      return;
    }

    const serviceList = services
      .slice(0, 5)
      .map((service) => `${service.name}: ${service.price}`)
      .join("\n");

    sendBot(`Voici les principaux services:\n${serviceList}`, [
      { label: "Prendre RDV", to: "/book" },
      { label: "Creneaux", ask: "Quels creneaux sont disponibles ?" },
    ], "Catalogue");
  };

  const answerWithSlots = async (offsetDays = 0) => {
    if (!hasToken()) {
      requireLogin("les creneaux disponibles");
      return;
    }

    const date = todayIso(offsetDays);
    const data = await getSlots(date);

    if (!data.success) {
      sendBot(data.message || "Impossible de charger les creneaux pour le moment.");
      return;
    }

    const available = (data.slots || []).filter((slot) => slot.status === "available");

    if (available.length === 0) {
      sendBot(`Aucun creneau disponible pour ${data.day || date}. Essayez une autre date.`, [
        { label: "Choisir une date", to: "/book" },
      ], "Disponibilites");
      return;
    }

    sendBot(
      `Creneaux disponibles (${data.day || date}): ${available
        .slice(0, 6)
        .map((slot) => slot.time)
        .join(", ")}.`,
      [
        { label: "Prendre RDV", to: "/book" },
        { label: "Demain", ask: "Creneaux demain" },
      ],
      "Disponibilites"
    );
  };

  const answerWithAppointments = async () => {
    if (!hasToken()) {
      requireLogin("vos rendez-vous");
      return;
    }

    if (getUser().role === "admin") {
      sendBot("Pour les RDV admin, ouvrez la vue generale du dashboard.", [
        { label: "Dashboard admin", to: "/admin-dashboard" },
      ], "Rendez-vous admin");
      return;
    }

    const data = await getMyAppointments();

    if (!data.success) {
      sendBot(data.message || "Impossible de charger vos rendez-vous.");
      return;
    }

    const appointments = data.appointments || [];

    if (appointments.length === 0) {
      sendBot("Vous n'avez pas encore de rendez-vous.", [
        { label: "Prendre RDV", to: "/book" },
        { label: "Scanner vehicule", to: "/ocr" },
      ], "Mes RDV");
      return;
    }

    const latest = appointments[0];
    sendBot(
      `Dernier RDV: ${latest.service_type} pour ${latest.car_model}\nDate: ${formatDate(
        latest.appointment_date
      )} a ${latest.appointment_time}\nStatut: ${statusLabel(latest.status)}`,
      [
        { label: "Mes RDV", to: "/my-appointments" },
        { label: "Nouveau RDV", to: "/book" },
      ],
      "Mes RDV"
    );
  };

  const handleQuestion = async (clean) => {
    const text = normalizeText(clean);
    const staticResponse = staticAnswer(clean, getUser());

    if (staticResponse) {
      sendBot(staticResponse.text, staticResponse.actions || [], staticResponse.title);
      return;
    }

    if (text.includes("service") || text.includes("entretien") || text.includes("prix")) {
      await answerWithServices();
      return;
    }

    if (text.includes("demain")) {
      await answerWithSlots(1);
      return;
    }

    if (text.includes("creneau") || text.includes("heure") || text.includes("disponible")) {
      await answerWithSlots();
      return;
    }

    if (text.includes("rdv") || text.includes("rendez") || text.includes("appointment")) {
      await answerWithAppointments();
      return;
    }

    sendBot(
      "Je peux vous aider sur les services, les creneaux, la prise de RDV, le scan OCR, l'OTP, le paiement et l'admin.",
      SUGGESTIONS,
      "Aide rapide"
    );
  };

  const sendMessage = async (text = input) => {
    const clean = text.trim();
    if (!clean || loading) return;

    addMessages({ from: "user", text: clean });
    setInput("");
    setLoading(true);

    try {
      await handleQuestion(clean);
    } catch (err) {
      console.error(err);
      sendBot("Je n'arrive pas a recuperer les informations. Reessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  const runAction = (action) => {
    if (action.to) {
      navigate(action.to);
      setOpen(false);
      return;
    }

    if (action.ask) {
      sendMessage(action.ask);
    }
  };

  return (
    <div className="chatbot">
      {open && (
        <section className="chatbot-panel" aria-label="Assistant Hyundai RDV">
          <div className="chatbot-head">
            <div className="chatbot-agent">
              <div className="chatbot-avatar">H</div>
              <div>
                <strong>Assistant RDV</strong>
                <div>{hasToken() ? "Connecte a votre espace" : "Support instantane"}</div>
              </div>
            </div>
            <button type="button" aria-label="Fermer l'assistant" onClick={() => setOpen(false)}>
              X
            </button>
          </div>

          <div className="chatbot-context">
            <span>Page actuelle</span>
            <strong>{location.pathname === "/" ? "Connexion" : location.pathname}</strong>
          </div>

          <div className="chatbot-body" ref={bodyRef}>
            {messages.map((message, index) => (
              <div key={`${message.from}-${index}`} className={`chat-msg ${message.from}`}>
                {message.title && <strong className="chat-msg-title">{message.title}</strong>}
                <div>{message.text}</div>
                {message.actions?.length > 0 && (
                  <div className="chat-actions">
                    {message.actions.map((action) => (
                      <button
                        key={`${index}-${action.label}`}
                        type="button"
                        onClick={() => runAction(action)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-msg bot typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <div className="chatbot-quick">
            {quickActions.map((action) => (
              <button key={action.label} type="button" onClick={() => runAction(action)}>
                {action.label}
              </button>
            ))}
          </div>

          <form
            className="chatbot-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Demandez un service, un creneau, un RDV..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Envoyer
            </button>
          </form>
        </section>
      )}

      <button
        className={`chatbot-toggle ${open ? "open" : ""}`}
        type="button"
        aria-label="Ouvrir l'assistant"
        onClick={() => setOpen((value) => !value)}
      >
        <span>H</span>
        Aide
      </button>
    </div>
  );
}

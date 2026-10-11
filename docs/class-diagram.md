# Hyundai RDV - Class Diagram

```mermaid
classDiagram
  direction LR

  class User {
    +int id
    +string email
    +string password
    +string role
    +datetime created_at
    +datetime updated_at
    +login()
    +logout()
    +verifyOtp()
  }

  class Client {
    +createAppointment()
    +cancelAppointment()
    +viewAppointments()
    +makePayment()
    +readNotifications()
  }

  class Admin {
    +approveAppointment()
    +rejectAppointment()
    +manageServices()
    +manageSlots()
    +viewReports()
  }

  class Appointment {
    +int id
    +int user_id
    +string car_model
    +string service_type
    +date appointment_date
    +time appointment_time
    +string plate_number
    +string status
    +datetime created_at
    +datetime updated_at
    +approve()
    +reject()
    +cancel()
  }

  class Service {
    +int id
    +string name
    +string price
    +boolean active
    +datetime created_at
    +datetime updated_at
    +activate()
    +deactivate()
  }

  class Slot {
    +int id
    +string day
    +time time
    +string status
    +datetime created_at
    +datetime updated_at
    +markAvailable()
    +markBusy()
    +markClosed()
  }

  class Payment {
    +int id
    +int appointment_id
    +int user_id
    +decimal amount
    +string currency
    +string method
    +string status
    +string transaction_ref
    +string card_last4
    +datetime created_at
    +datetime updated_at
    +process()
    +markPaid()
    +markPending()
  }

  class Notification {
    +int id
    +int user_id
    +string message
    +boolean is_read
    +datetime created_at
    +markAsRead()
  }

  class OtpCode {
    +int id
    +string email
    +string code
    +datetime expires_at
    +datetime consumed_at
    +datetime created_at
    +send()
    +verify()
    +consume()
  }

  class KeycloakAuth {
    +string realm
    +string clientId
    +login()
    +refreshToken()
    +createUser()
    +assignRole()
    +validateToken()
  }

  class AppointmentController {
    +createAppointment()
    +getMyAppointments()
    +getAllAppointments()
    +cancelAppointment()
    +approveAppointment()
    +rejectAppointment()
  }

  class CatalogController {
    +getServices()
    +createService()
    +updateService()
    +deleteService()
    +getSlots()
    +createSlot()
    +updateSlot()
    +deleteSlot()
  }

  class PaymentController {
    +createPayment()
    +getMyPayments()
    +getAllPayments()
  }

  class OtpController {
    +sendOtp()
    +verifyOtp()
  }

  class NotificationController {
    +getNotifications()
    +markNotificationAsRead()
  }

  class Chatbot {
    +answerQuestion()
    +showServices()
    +showSlots()
    +showAppointments()
    +navigateToPage()
  }

  User <|-- Client
  User <|-- Admin

  Client "1" --> "0..*" Appointment : creates
  Client "1" --> "0..*" Payment : makes
  Client "1" --> "0..*" Notification : receives
  Client "1" --> "0..*" OtpCode : verifies email with

  Appointment "1" --> "0..1" Payment : has
  Appointment "*" --> "1" Service : uses
  Appointment "*" --> "1" Slot : reserves

  Admin "1" --> "0..*" Appointment : reviews
  Admin "1" --> "0..*" Service : manages
  Admin "1" --> "0..*" Slot : manages

  KeycloakAuth --> User : authenticates
  KeycloakAuth --> Client : assigns client role
  KeycloakAuth --> Admin : assigns admin role

  AppointmentController --> Appointment
  AppointmentController --> Notification
  AppointmentController --> Slot
  CatalogController --> Service
  CatalogController --> Slot
  PaymentController --> Payment
  PaymentController --> Appointment
  OtpController --> OtpCode
  NotificationController --> Notification
  Chatbot --> AppointmentController : reads data
  Chatbot --> CatalogController : reads services/slots
```

## Notes

- `User`, `Client`, and `Admin` are represented by Keycloak users plus the local `users` table.
- `Service` and `Slot` are managed by the admin and stored in MySQL.
- `Appointment` connects the client, selected service, selected slot, vehicle data, and status.
- `Payment` is currently a simulated payment module.
- `Chatbot` is a frontend assistant that reads real app data through the API.

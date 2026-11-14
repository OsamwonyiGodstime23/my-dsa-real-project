# Architecture

## Layers

```mermaid
flowchart TD
    Routes[HTTP routes] --> Services[Application services]
    Services --> Rules[Domain rules]
    Services --> Repositories[Repositories]
    Repositories --> Data[(Data store)]
```

- **Routes** may translate HTTP input and output; they may not implement business rules or access storage directly.
- **Services** may coordinate domain rules and repositories; they may not depend on HTTP details or send responses.
- **Rules** may enforce business invariants; they may not perform I/O or depend on services, routes, or repositories.
- **Repositories** may read and write data; they may not implement business policy or call higher layers.
- **Data** is stored state; it does not call application code.

## Data model

```mermaid
erDiagram
    EVENT ||--|{ TICKET_TIER : offers
    EVENT ||--o{ BOOKING : receives
    TICKET_TIER ||--o{ BOOKING : reserves
    USER ||--o{ BOOKING : makes

    EVENT {
        string id
        string title
        string city
        string venue
        string date
        boolean published
    }
    TICKET_TIER {
        string id
        string eventId
        string name
        integer priceCents
        integer capacity
    }
    BOOKING {
        string id
        string userId
        string eventId
        string tierId
        integer quantity
        integer totalCents
        string status
    }
    USER {
        string id
        string name
        string email
        string role
    }
```

## Booking life cycle

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> paid
    pending --> cancelled
    paid --> checked_in
    paid --> refunded
    paid --> cancelled
    cancelled --> [*]
    refunded --> [*]
    checked_in --> [*]
```

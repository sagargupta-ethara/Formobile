# Test Credentials — Blueprint Flow

All seeded users share the password: **`password123`**

| Role     | Email                       |
|----------|-----------------------------|
| Admin    | admin@blueprint.test        |
| Designer | designer@blueprint.test     |
| Designer | priya@blueprint.test        |
| On-Site  | onsite@blueprint.test       |
| On-Site  | plumber@blueprint.test      |

## Database
- Host: `localhost:5432`
- User: `bf`  /  Password: `bfpass`  /  DB: `blueprint_flow`
- Connection string: `postgresql://bf:bfpass@localhost:5432/blueprint_flow`

## Storage
- Local disk at `/app/storage` (ephemeral on container restart)

## Re-seed
```
cd /app && yarn db:push && yarn db:seed
```

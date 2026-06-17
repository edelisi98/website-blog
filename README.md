# Elire Resource API

This repo hosts the JavaScript bundle used by the Webflow Blog Home copy and
will also host a tiny Webflow Cloud API app.

## Test endpoint

After deploying to Webflow Cloud, visit:

```txt
/api/resources
```

If the app path is set to `/resource-api`, the full path will be:

```txt
/resource-api/api/resources
```

## Environment variables

Later, add this environment variable in Webflow Cloud:

```txt
WEBFLOW_API_TOKEN
```

Do not paste the token into Webflow page custom code.

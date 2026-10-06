var builder = WebApplication.CreateBuilder(args);

// Explicitly bind to port 5000 on all network interfaces
builder.WebHost.UseUrls("http://0.0.0.0:5000");

var app = builder.Build();

// Root Route - HTML Website
app.MapGet("/", () => Results.Content(@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Radix CMS - .NET Engine</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      max-width: 450px;
      text-align: center;
    }
    .badge {
      background: #512bd4;
      color: #f3f0ff;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 { margin: 1rem 0 0.5rem 0; font-size: 1.75rem; color: #a78bfa; }
    p { color: #94a3b8; line-height: 1.5; }
    .footer { margin-top: 1.5rem; font-size: 0.85rem; color: #64748b; }
  </style>
</head>
<body>
  <div class=""card"">
    <span class=""badge"">ASP.NET Core Engine</span>
    <h1>Salve Mundi</h1>
    <p>Radix CMS .NET web server is active and running.</p>
    <div class=""footer"">Listening on port <strong>5000</strong></div>
  </div>
</body>
</html>
", "text/html"));

// JSON API Route
app.MapGet("/api/status", () => Results.Ok(new
{
    status = "online",
    engine = "ASP.NET Core (.NET)",
    timestamp = DateTime.UtcNow.ToString("o")
}));

app.Run();
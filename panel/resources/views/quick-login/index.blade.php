<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quick Login</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #172033;
      --muted: #64748b;
      --line: #dbe3ef;
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --danger: #b91c1c;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    .page {
      width: min(1120px, calc(100% - 32px));
      margin: 32px auto;
    }

    .header,
    .toolbar,
    .section-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }

    .header {
      margin-bottom: 18px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.1;
    }

    .subtext,
    .count,
    .section-heading p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }

    .toolbar {
      padding: 16px;
      border-bottom: 1px solid var(--line);
    }

    .toolbar label {
      display: grid;
      gap: 6px;
      flex: 1;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    .toolbar input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
      color: var(--text);
      font-size: 14px;
    }

    .section-heading {
      padding: 18px 16px 10px;
      border-top: 1px solid var(--line);
    }

    .toolbar + .section-heading {
      border-top: 0;
    }

    .section-heading h2 {
      margin: 0 0 4px;
      font-size: 18px;
    }

    .alert {
      margin: 0 0 16px;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fee2e2;
      color: var(--danger);
      border: 1px solid #fecaca;
      font-weight: 700;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 780px;
    }

    th,
    td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
      font-size: 14px;
    }

    th {
      background: #f8fafc;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    .name {
      font-weight: 700;
    }

    .muted {
      color: var(--muted);
    }

    .stack {
      display: grid;
      gap: 3px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .status {
      background: #ecfdf5;
      color: #047857;
    }

    .status.inactive {
      background: #f1f5f9;
      color: #475569;
    }

    .btn {
      border: 0;
      border-radius: 6px;
      background: var(--primary);
      color: #ffffff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      padding: 10px 14px;
      white-space: nowrap;
    }

    .btn:hover {
      background: var(--primary-dark);
    }

    .empty {
      padding: 34px 16px;
      text-align: center;
      color: var(--muted);
    }

    @media (max-width: 700px) {
      .page {
        width: min(100% - 20px, 1120px);
        margin: 18px auto;
      }

      .header,
      .toolbar,
      .section-heading {
        align-items: stretch;
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>
        <h1>Quick Login</h1>
        <p class="subtext">Select any LI number or user and click Login. No email, password, or OTP is required.</p>
      </div>
      <p class="count">{{ count($properties) }} LI logins / {{ count($users) }} users</p>
    </header>

    @error('login')
      <div class="alert">{{ $message }}</div>
    @enderror

    <section class="panel">
      <form class="toolbar" method="get" action="{{ route('quick-login.index') }}">
        <label>
          Frontend URL
          <input name="frontend_url" value="{{ $frontendUrl }}" placeholder="http://localhost:5173">
        </label>
        <button class="btn" type="submit">Apply URL</button>
      </form>

      <div class="section-heading">
        <div>
          <h2>LI Number Logins</h2>
          <p>Property manager login with LI number access.</p>
        </div>
        <p>{{ count($properties) }} records</p>
      </div>

      @if ($properties === [])
        <div class="empty">No LI numbers found.</div>
      @else
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>LI Number</th>
                <th>Property</th>
                <th>Management</th>
                <th>Manager Profile</th>
                <th>Address</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @foreach ($properties as $property)
                <tr>
                  <td>{{ $property['id'] }}</td>
                  <td><span class="badge">{{ $property['li_number'] }}</span></td>
                  <td>
                    <div class="stack">
                      <div class="name">{{ $property['title'] }}</div>
                      <div class="muted">Manager ID: {{ $property['manager_profile_id'] ?: 'will create' }}</div>
                    </div>
                  </td>
                  <td>{{ $property['management'] ?: '-' }}</td>
                  <td>
                    <div class="stack">
                      <div>{{ $property['manager_name'] ?: '-' }}</div>
                      <div class="muted">{{ $property['manager_email'] ?: '-' }}</div>
                      @if ($property['manager_phone'])
                        <div class="muted">{{ $property['manager_phone'] }}</div>
                      @endif
                    </div>
                  </td>
                  <td>
                    <div class="stack">
                      <div>{{ $property['address_line_1'] ?: '-' }}</div>
                      @if ($property['address_line_2'])
                        <div class="muted">{{ $property['address_line_2'] }}</div>
                      @endif
                      <div class="muted">{{ trim(($property['postal_code'] ?? '').' '.($property['city'] ?? '')) ?: '-' }}</div>
                    </div>
                  </td>
                  <td>
                    <span class="badge status {{ $property['status'] === 'active' ? '' : 'inactive' }}">
                      {{ $property['status'] ?: 'unknown' }}
                    </span>
                  </td>
                  <td>
                    <form method="post" action="{{ route('quick-login.login') }}">
                      @csrf
                      <input type="hidden" name="login_type" value="property">
                      <input type="hidden" name="property_id" value="{{ $property['id'] }}">
                      <input type="hidden" name="frontend_url" value="{{ $frontendUrl }}">
                      <button class="btn" type="submit">Login</button>
                    </form>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
      @endif

      <div class="section-heading">
        <div>
          <h2>User Logins</h2>
          <p>Regular user login by selected user account.</p>
        </div>
        <p>{{ count($users) }} records</p>
      </div>

      @if ($users === [])
        <div class="empty">No users found.</div>
      @else
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @foreach ($users as $user)
                <tr>
                  <td>{{ $user['id'] }}</td>
                  <td>
                    <div class="name">{{ $user['name'] }}</div>
                    @if ($user['company_name'])
                      <div class="muted">{{ $user['company_name'] }}</div>
                    @endif
                  </td>
                  <td>{{ $user['email'] }}</td>
                  <td><span class="badge">{{ $user['role_name'] }}</span></td>
                  <td>
                    <span class="badge status {{ $user['status'] === 'active' ? '' : 'inactive' }}">
                      {{ $user['status'] ?: 'unknown' }}
                    </span>
                  </td>
                  <td>
                    <form method="post" action="{{ route('quick-login.login') }}">
                      @csrf
                      <input type="hidden" name="login_type" value="user">
                      <input type="hidden" name="user_id" value="{{ $user['id'] }}">
                      <input type="hidden" name="frontend_url" value="{{ $frontendUrl }}">
                      <button class="btn" type="submit">Login</button>
                    </form>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
      @endif
    </section>
  </main>
</body>
</html>

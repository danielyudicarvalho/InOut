using System.Net;

namespace InOut.Infrastructure.Identity;

public static class EmailTemplates
{
    public static string ConfirmationEmailHtml(string code, string link, int expiryMinutes)
    {
        var encodedLink = WebUtility.HtmlEncode(link);
        return $@"<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Confirme seu e-mail no InOut</title>
</head>
<body style=""margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;"">
  <table role=""presentation"" width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color:#0b0f19;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width:520px;background-color:#111827;border:1px solid #1f2937;border-radius:16px;padding:36px;text-align:left;"">
          <tr>
            <td style=""padding-bottom:24px;"">
              <span style=""font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;"">InOut</span>
            </td>
          </tr>
          <tr>
            <td style=""padding-bottom:16px;"">
              <h1 style=""margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;"">Confirme seu endereço de e-mail</h1>
            </td>
          </tr>
          <tr>
            <td style=""padding-bottom:24px;font-size:15px;line-height:1.6;color:#9ca3af;"">
              Use o código de verificação abaixo para concluir o acesso à sua conta InOut. Ele expira em <strong>{expiryMinutes} minutos</strong> e é de uso único.
            </td>
          </tr>
          <tr>
            <td align=""center"" style=""padding-bottom:28px;"">
              <div style=""display:inline-block;padding:16px 32px;background-color:#1e293b;border:1px solid #334155;border-radius:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:6px;color:#38bdf8;"">
                {code}
              </div>
            </td>
          </tr>
          <tr>
            <td align=""center"" style=""padding-bottom:28px;"">
              <a href=""{encodedLink}"" style=""display:inline-block;padding:14px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;"">Confirmar e-mail automaticamente</a>
            </td>
          </tr>
          <tr>
            <td style=""border-top:1px solid #1f2937;padding-top:20px;font-size:12px;line-height:1.5;color:#6b7280;"">
              Se você não solicitou este e-mail, pode ignorá-lo com segurança. Nenhuma ação adicional é necessária.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
    }

    public static string PasswordResetEmailHtml(string code, string link, int expiryMinutes)
    {
        var encodedLink = WebUtility.HtmlEncode(link);
        return $@"<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Redefinição de senha do InOut</title>
</head>
<body style=""margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;"">
  <table role=""presentation"" width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color:#0b0f19;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width:520px;background-color:#111827;border:1px solid #1f2937;border-radius:16px;padding:36px;text-align:left;"">
          <tr>
            <td style=""padding-bottom:24px;"">
              <span style=""font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;"">InOut</span>
            </td>
          </tr>
          <tr>
            <td style=""padding-bottom:16px;"">
              <h1 style=""margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;"">Redefinição de senha</h1>
            </td>
          </tr>
          <tr>
            <td style=""padding-bottom:24px;font-size:15px;line-height:1.6;color:#9ca3af;"">
              Recebemos uma solicitação para redefinir a senha da sua conta InOut. Use o código abaixo ou clique no botão. Ele expira em <strong>{expiryMinutes} minutos</strong>.
            </td>
          </tr>
          <tr>
            <td align=""center"" style=""padding-bottom:28px;"">
              <div style=""display:inline-block;padding:16px 32px;background-color:#1e293b;border:1px solid #334155;border-radius:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:6px;color:#f59e0b;"">
                {code}
              </div>
            </td>
          </tr>
          <tr>
            <td align=""center"" style=""padding-bottom:28px;"">
              <a href=""{encodedLink}"" style=""display:inline-block;padding:14px 28px;background-color:#d97706;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:10px;"">Redefinir senha</a>
            </td>
          </tr>
          <tr>
            <td style=""border-top:1px solid #1f2937;padding-top:20px;font-size:12px;line-height:1.5;color:#6b7280;"">
              Se você não solicitou a redefinição da sua senha, recomendamos verificar o acesso à sua conta.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
    }

    public static string ExistingAccountEmailHtml()
    {
        return @"<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Aviso da sua conta InOut</title>
</head>
<body style=""margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;"">
  <table role=""presentation"" width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color:#0b0f19;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width:520px;background-color:#111827;border:1px solid #1f2937;border-radius:16px;padding:36px;text-align:left;"">
          <tr>
            <td style=""padding-bottom:24px;"">
              <span style=""font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;"">InOut</span>
            </td>
          </tr>
          <tr>
            <td style=""padding-bottom:16px;"">
              <h1 style=""margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;"">Conta InOut existente</h1>
            </td>
          </tr>
          <tr>
            <td style=""padding-bottom:24px;font-size:15px;line-height:1.6;color:#9ca3af;"">
              Houve uma tentativa de criar uma conta com este endereço de e-mail. Como você já possui uma conta ativa, nenhuma nova conta foi criada.
            </td>
          </tr>
          <tr>
            <td style=""border-top:1px solid #1f2937;padding-top:20px;font-size:12px;line-height:1.5;color:#6b7280;"">
              Se você esqueceu sua senha, acesse o aplicativo e utilize a opção de recuperação de senha.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InOut.Infrastructure.Identity.Migrations
{
    /// <inheritdoc />
    public partial class IdentityTotpReplay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "last_totp_step",
                schema: "identity",
                table: "users",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_totp_step",
                schema: "identity",
                table: "users");
        }
    }
}

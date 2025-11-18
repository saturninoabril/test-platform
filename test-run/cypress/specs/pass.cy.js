describe("Example domain", () => {
  it("MM-T001 has title", () => {
    cy.visit("");
    cy.title().should("eq", "Example Domain");
  });

  it("MM-T002 has heading", () => {
    cy.visit("");
    cy.get("h1").should("contain", "Example Domain");
  });
});

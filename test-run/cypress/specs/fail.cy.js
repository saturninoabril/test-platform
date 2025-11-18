describe("Example domain fail", () => {
  it("MM-T003 has title", () => {
    cy.visit("");
    cy.title().should("eq", "Not correct title");
  });
});

"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("users", {
      fields: ["email"],
      type: "unique",
      name: "users_email_ukey",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("users", "users_email_ukey");
  },
};

"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Tasks extends Model {
    static associate(models) {
      Tasks.belongsTo(models.Collections, {
        foreignKey: "collections_id",
        as: "collection",
      });
    }
  }
  Tasks.init(
    {
      name: DataTypes.STRING,
      is_done: DataTypes.BOOLEAN,
      collections_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Tasks",
      tableName: "tasks", // Pastikan ini sesuai
    }
  );
  return Tasks;
};

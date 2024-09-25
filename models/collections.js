"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Collections extends Model {
    static associate(models) {
      Collections.hasMany(models.Tasks, {
        foreignKey: "collections_id",
        as: "tasks",
      });
      Collections.belongsTo(models.Users, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  }
  Collections.init(
    {
      name: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Collections",
      tableName: "collections", // Pastikan nama tabelnya sesuai
    }
  );
  return Collections;
};

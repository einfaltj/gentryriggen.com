var db = require('../db');

var repo = function (tableName, model) {
  var baseRepo = {};

  baseRepo.getPaginatedParams = function (params) {
    var page = 'page' in params ? parseInt(params.page) : 1,
      pageSize = 'pageSize' in params ? parseInt(params.pageSize) : 5,
      skip = (page - 1) * pageSize;

    return {page: page, pageSize: pageSize, skip: skip};
  };

  baseRepo.getById = function (id, idField) {
    var selectField = idField ? idField : 'id';
    return db(tableName).where(selectField, id).first()
      .then(function (item) {
        return model.toJson(item);
      });
  };

  baseRepo.getByIds = function (idsArray, idField, orderByField, orderByDirection) {
    var selectField = idField ? idField : 'id';
    var query = db(tableName)
      .whereIn(selectField, idsArray);

    if (orderByField) {
      var direction = orderByDirection && (orderByDirection == 'ASC' || orderByDirection == 'DSEC') ?
        orderByDirection : 'ASC';
      query.orderBy(orderByField, direction);
    }

    return query.then(function (results) {
      var modeledResults = [];
      results.forEach(function (result) {
        modeledResults.push(model.toJson(result));
      });

      return modeledResults;
    });
  };

  baseRepo.createOrUpdate = function (data, convert) {
    if (convert && model.fromJson) {
      data = model.fromJson(data);
    }
    var update = data.id > 0;
    if (!update) {
      delete data.id;
    }
    var query = update ? db(tableName).where('id', data.id).update(data) : db.insert(data).into(tableName).returning('id');
    return query.then(function (ids) {
      return update ? null : baseRepo.getById(ids[0]);
    });
  };

  baseRepo.del = function (id) {
    return db(tableName).where('id', id).del();
  };

  return baseRepo;
};

module.exports = repo;

var db = require('../db'),
  moment = require('moment'),
  conf = require('../config/conf');
require('moment-timezone');

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
      var direction = orderByDirection && (orderByDirection == 'ASC' || orderByDirection == 'DESC') ?
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

  baseRepo.createOrUpdate = function (data, convert, keepId = false) {
    if (convert && model.fromJson) {
      data = model.fromJson(data);
    }
    var update = data.id > 0;
    if (!keepId && !update) {
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

  baseRepo.onSameDay = function (date1, date2) {
    date1 = moment(date1).tz(conf.msftHealth.timeZone);
    date2 = moment(date2).tz(conf.msftHealth.timeZone);

    return (date1.year() == date2.year()) && (date1.month() == date2.month()) && (date1.date() == date2.date());
  };

  baseRepo.convertDateToLocal = function (date, toISOString) {
    date = moment(date).tz(conf.msftHealth.timeZone);
    return toISOString ? date.toDate().toISOLocalString() : date;
  };

  baseRepo.getTodayLocal = function (toISOString) {
    var now = moment().tz(conf.msftHealth.timeZone);
    return toISOString ? now.toDate().toISOLocalString() : now;
  };

  baseRepo.getDateNDaysFromNow = function (days, toISOString) {
    var now = baseRepo.getTodayLocal(false);
    var requestedDate = days > 0 ? now.add(days, 'days') : now.subtract(Math.abs(days), 'days');

    return toISOString ? requestedDate.toDate().toISOLocalString() : requestedDate;
  };

  baseRepo.getDateNDaysFromDate = function (date, days, toISOString) {
    date = date ? date : new Date();
    var startDate = moment(date).tz(conf.msftHealth.timeZone);
    var requestedDate = days > 0 ? startDate.add(days, 'days') : startDate.subtract(Math.abs(days), 'days');

    return toISOString ? requestedDate.toDate().toISOLocalString() : requestedDate;
  };

  baseRepo.ensureStartAndEndTime = function (startTime, endTime, toISOLocalString) {
    startTime = startTime ? moment(startTime).tz(conf.msftHealth.timeZone) : moment().tz(conf.msftHealth.timeZone);
    startTime.hour(0);
    startTime.minute(0);
    startTime.second(0);

    endTime = endTime ? moment(endTime).tz(conf.msftHealth.timeZone) : moment(startTime).tz(conf.msftHealth.timeZone);
    endTime.hour(23);
    endTime.minute(59);
    endTime.second(59);

    // Test end date not being greater than current UTC
    var utcNow = moment.utc().tz(conf.msftHealth.timeZone);
    if (endTime > utcNow) {
      endTime = utcNow;
    }

    if (toISOLocalString === true) {
      return {
        startTime: startTime.toDate().toISOLocalString(),
        endTime: endTime.toDate().toISOLocalString()
      };
    } else {
      return {
        startTime: startTime.toDate(),
        endTime: endTime.toDate()
      };
    }
  };

  baseRepo.objectifySQLResult = function (results, collectionName) {
    var i,
      prop,
      roots = [],
      root = {},
      collection = [],
      currentId,
      collectionItem = {};
    for (i = 0; i < results.length; i++) {
      if (!currentId) {
        currentId = results[i].id;
      }

      if (currentId != results[i].id) {
        currentId = results[i].id;
        root[collectionName] = collection;
        roots.push(root);
        collection = [];
        root = {};
      }

      collectionItem = {};
      for (prop in results[i]) {
        if (prop.indexOf(collectionName) !== -1) {
          collectionItem[(prop.substr(collectionName.length + 1))] = results[i][prop];
        } else {
          root[prop] = results[i][prop];
        }
      }

      collection.push(collectionItem);
    }

    root[collectionName] = collection;
    roots.push(root);
    return roots;
  };

  return baseRepo;
};

module.exports = repo;

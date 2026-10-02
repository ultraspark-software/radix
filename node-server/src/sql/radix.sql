/*
SQLyog Community v13.2.1 (64 bit)
MySQL - 10.9.1-MariaDB : Database - radix
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`radix` /*!40100 DEFAULT CHARACTER SET latin1 */;

USE `radix`;

/*Table structure for table `pages` */

DROP TABLE IF EXISTS `pages`;

CREATE TABLE `pages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `template_name` varchar(50) DEFAULT 'default',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('Published','Pending Review','Draft','Archived','Deleted') NOT NULL DEFAULT 'Draft',
  `min_role` enum('Administrator','Manager','Editor','Registered','Unregistered') NOT NULL DEFAULT 'Unregistered',
  `publish_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1;

/*Data for the table `pages` */

insert  into `pages`(`id`,`title`,`slug`,`content`,`template_name`,`created_at`,`status`,`min_role`,`publish_at`) values 
(1,'Welcome Home','home','<h1>Hello World!</h1><p>Welcome to my lightweight Node.js CMS.</p>','default','2026-06-26 15:16:12','Published','Unregistered','2026-08-06 15:45:00'),
(2,'About Us','about','<h1>About Our System</h1>\r\n<p>This page is completely dynamic.</p>\r\n<h2>This is a test.</h2>','default','2026-06-26 15:16:12','Published','Unregistered','2026-08-05 17:27:00');

/*Table structure for table `plugins` */

DROP TABLE IF EXISTS `plugins`;

CREATE TABLE `plugins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folder_name` varchar(150) NOT NULL,
  `is_active` tinyint(1) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `folder_name` (`folder_name`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

/*Data for the table `plugins` */

/*Table structure for table `schema_meta` */

DROP TABLE IF EXISTS `schema_meta`;

CREATE TABLE `schema_meta` (
  `key_name` varchar(100) NOT NULL,
  `value_text` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Data for the table `schema_meta` */

insert  into `schema_meta`(`key_name`,`value_text`,`updated_at`) values 
('db_initialized','1','2026-08-27 08:47:08'),
('schema_version','1.0.0','2026-08-27 08:47:08');

/*Table structure for table `settings` */

DROP TABLE IF EXISTS `settings`;

CREATE TABLE `settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

/*Data for the table `settings` */

insert  into `settings`(`setting_key`,`setting_value`) values 
('app_name','Radix'),
('app_version','1.0.1'),
('mail_from','noreply@radixcms.com'),
('mail_host',''),
('mail_pass',''),
('mail_port','25'),
('mail_secure','0'),
('mail_user',''),
('site_logo','');

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `role` enum('Administrator','Manager','Editor','Registered','Unregistered') NOT NULL DEFAULT 'Registered',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
